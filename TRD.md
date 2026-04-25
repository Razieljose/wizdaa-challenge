# TRD: Time-Off Microservice

---

## Problem

ExampleHR (and similar products like ReadyOn) serve as the primary interface for employees to request time off. However, the Human Capital Management (HCM) system (e.g., Workday, SAP) remains the **Source of Truth** for employment data and time-off balances.

**The core difficulty:** keeping balances synced between two independent systems. If an employee has 10 days of leave and requests 2 days through our platform, we must ensure the HCM agrees they have the balance — and we must handle cases where the HCM balance changes independently (e.g., a "work anniversary" bonus, start-of-year refresh, or manual HR correction).

There is currently no dedicated backend mechanism to manage the full lifecycle of a time-off request while maintaining strict balance integrity against the HCM.

## Domain Context

This section defines the key domain concepts for readers unfamiliar with HCM integrations.

*Time-Off Request* — A formal request by an employee to take time off for a specific period. Each request is scoped to a single employee and a single location. The request progresses through a state machine (PENDING → APPROVED → SYNCED → COMPLETED, or branching into FAILED/CANCELLED).

*HCM (Source of Truth)* — The central Human Capital Management system maintained by the customer. It provides:
- A **real-time API** to get or send individual time-off values (e.g., 1 day for `locationId` X for `employeeId` Y).
- A **batch endpoint** that sends the entire corpus of time-off balances (with necessary dimensions) to our platform.
- **Error responses** for invalid dimension combinations or insufficient balance — *however, this is not always guaranteed*. The system must be defensive.

*Balance Integrity* — The state where local time-off balances and HCM balances are logically consistent, accounting for pending requests, in-flight sync operations, and external HCM changes.

*Effective Balance* — The locally computed available balance: `HCM Last Known Balance − SUM(pending + approved + in-flight requests)`. This is the number shown to the employee and used for pre-validation.

**User Personas:**
- **The Employee:** Wants to see an accurate balance and get instant feedback on requests.
- **The Manager:** Needs to approve requests with confidence that the underlying data is valid.

## Requirements

### Functional Requirements
- REST endpoints for submitting, approving, rejecting, and cancelling time-off requests.
- Real-time effective balance calculation that accounts for pending/in-flight requests.
- Idempotent request submission (via `idempotencyKey`) to prevent duplicate entries.
- State machine governing request lifecycle with strict transition validation.
- Real-time sync with HCM on approval (push the approved request to HCM via its API).
- Batch reconciliation job that pulls the full HCM balance dump and reconciles local records without double-counting in-flight requests.
- Webhook endpoint for HCM-initiated balance push notifications (`POST /api/webhooks/hcm/balance`). Validated via `X-Webhook-Secret` header.
- HCM reversal on COMPLETED cancellation: when a COMPLETED request is cancelled, the system calls the HCM real-time API to reverse the deduction. If HCM rejects the reversal, the request stays COMPLETED and is flagged in logs for manual review.
- Production-ready migration scripts (`migration:run`, `migration:revert`, `migration:show`, `migration:generate`) backed by `src/database/data-source.ts`.
- Automatic database seed on first start in non-production environments. Creates 1 manager and 2 employees with roles, balances, and sample requests.

### Architectural Standards
- **RBAC & Location Validation:** Every operation must validate the actor's role (EMPLOYEE, MANAGER) AND verify they belong to the target `locationId`. A manager cannot approve requests for locations outside their scope.
- **Interface-First Design (SOLID):** Every Service and Repository must implement a dedicated TypeScript interface. This enforces loose coupling and simplifies mocking in tests. Note: NestJS DI injects concrete classes (not interface tokens); interfaces serve as compile-time contracts and documentation, not runtime tokens.
- **Atomic Mutations:** Every operation that combines a request state change with an audit log entry MUST execute within a single TypeORM `DataSource.transaction()`. If any step fails, the entire operation rolls back. Read-only operations do not require transactions.
- **Defense-in-depth Guards:** Mutations on `/requests/:id/*` go through `RequestLocationGuard` at the controller layer, which loads the request and verifies the actor has a role at its `locationId` before the service is invoked. Service-level `validateManagerAccess` remains as a second check.
- **Manual Review Flag:** When a COMPLETED → CANCELLED reversal is rejected by HCM, the request must not silently revert to COMPLETED in logs only. A persistent column `manualReviewReason` on `time_off_requests` stores the failure reason (format: `HCM_REVERSAL_REJECTED:<hcm-error-message>`). Queryable via `WHERE manualReviewReason IS NOT NULL` for operator review.
- **Java-Style Exception Hierarchy:** A `BaseError` class (extending native `Error`) with `code`, `details`, and `httpStatus` fields. All domain exceptions (e.g., `InsufficientBalanceError`, `HCMUnavailableError`, `RequestStateConflictError`) must extend `BaseError`.
- **Shared Abstractions:** A `shared/` directory with `BaseRepository<T>` (inherited by all read-focused repos), global interfaces, types, enums, and a centralized exception filter.
- **CQRS (Pragmatic):** Modules with complex lifecycles (`request`, `balance`, `user`) separate read repositories (extending `BaseRepository<T>`) from write repositories (standalone). The `user_location_roles` join table uses a unified repository — splitting it would add boilerplate without meaningful benefit.
- **Date/Time Strategy:** Use `dayjs` with UTC and timezone plugins. Database uses dual-column strategy for dates: ISO string for display, UNIX integer for computation.
- **Per-File Unit Testing:** Every implementation file must have a corresponding `.spec.ts` inside a `__tests__/` folder within each module.

## Constraints

- **NestJS and SQLite** are mandatory (per assignment requirements).
- **Agentic development approach:** No manual coding. The value lies in the rigor of the TRD and test cases.
- The microservice **must be defensive** about HCM failures — HCM error responses are not guaranteed.
- Balances are **per-employee per-location**.
- SQLite concurrency limitations must be addressed (WAL mode + `busy_timeout`).

## Solution

*Approach:* A dedicated Time-Off Microservice in NestJS that acts as a state machine and local balance cache. It provides instant feedback to users via effective balance calculations, syncs approved requests to the HCM in real-time, and runs a batch reconciliation job to correct drift.

| Component | Technology | Why This Choice |
| :---- | :---- | :---- |
| Microservice framework | NestJS | Required. Strong modularity, decorator-based architecture fits interface-first design. |
| Persistence | SQLite + TypeORM | Required. WAL mode for concurrent reads. Optimistic locking via `@VersionColumn`. |
| HCM Communication | NestJS HttpModule (Axios) | Anti-corruption layer isolates domain from HCM API specifics. Retry + timeout built in. |
| Validation | class-validator + class-transformer | Declarative DTO validation with decorators. |
| Auth | @nestjs/jwt + @nestjs/passport | Standard JWT-based auth with custom RBAC guards. |
| Date handling | dayjs (utc + timezone plugins) | Lightweight, actively maintained. Replaces deprecated Moment.js. |
| Testing | Jest + Supertest + @nestjs/testing | Unit, integration, and E2E coverage. |

### Architecture

```
┌──────────────────────────────────┐
│  Client (ExampleHR / ReadyOn)    │
└──────────┬───────────────────────┘
           │ REST / GraphQL
           ▼
┌──────────────────────────────────┐
│  Time-Off Microservice (NestJS)  │
│                                  │
│  ┌─────────┐  ┌───────────────┐  │
│  │ Auth    │  │ Balance       │  │
│  │ Module  │  │ Module        │  │
│  │ (RBAC)  │  │ (eff.balance) │  │
│  └─────────┘  └───────────────┘  │
│  ┌─────────────────────────────┐ │
│  │ Request Module              │ │
│  │ (State Machine + Lifecycle) │ │
│  └─────────────────────────────┘ │
│  ┌──────────┐  ┌──────────────┐  │
│  │ HCM      │  │ Sync Module  │  │
│  │ Client   │  │ (Batch Cron) │  │
│  └────┬─────┘  └──────┬───────┘  │
└───────┼────────────────┼─────────┘
        │                │
        ▼                ▼
┌──────────────────────────────────┐
│  HCM System (Source of Truth)    │
│  • Real-time API                 │
│  • Batch endpoint                │
└──────────────────────────────────┘
```

### Data Model

**`users` table**

| Column | Type | Notes |
| :---- | :---- | :---- |
| `id` | UUID (PK) | |
| `email` | VARCHAR | Unique |
| `name` | VARCHAR | |
| `passwordHash` | VARCHAR | Bcrypt hash |
| `isActive` | BOOLEAN | Default true |
| `createdAt` | VARCHAR (ISO) | Audit |
| `updatedAt` | VARCHAR (ISO) | Audit |
| `createdBy` | UUID (nullable) | Audit — who created this user |
| `updatedBy` | UUID (nullable) | Audit — who last modified |

*Indices:* `UNIQUE(email)`

**`user_location_roles` table**
Maps a user to a specific role within a specific location. A user can have different roles in different locations (e.g., EMPLOYEE in location A, MANAGER in location B).

| Column | Type | Notes |
| :---- | :---- | :---- |
| `id` | UUID (PK) | |
| `userId` | UUID (FK → users) | |
| `locationId` | VARCHAR | The location this role applies to |
| `role` | ENUM | EMPLOYEE, MANAGER |
| `createdAt` | VARCHAR (ISO) | Audit |
| `updatedAt` | VARCHAR (ISO) | Audit |
| `createdBy` | UUID (nullable) | Audit — who assigned this role |
| `updatedBy` | UUID (nullable) | Audit — who last modified |

*Indices:* `UNIQUE(userId, locationId, role)`, `INDEX(userId)`, `INDEX(locationId, role)`

**RBAC resolution:** When a user authenticates, the system loads all their `user_location_roles` to build the `IActor` context. Guards then use this to check: (1) does the actor have the required role? (2) does the actor hold that role in the target `locationId`?

**`employee_balances` table**

| Column | Type | Notes |
| :---- | :---- | :---- |
| `id` | UUID (PK) | |
| `employeeId` | UUID (FK → users) | Indexed |
| `locationId` | VARCHAR | Indexed |
| `hcmBalance` | DECIMAL | Last known HCM balance |
| `lastSyncedAt` | VARCHAR (ISO) | Display-friendly |
| `lastSyncedAtTimestamp` | INTEGER | UNIX epoch for computation |
| `version` | INTEGER | Optimistic locking (`@VersionColumn`) |

*Indices:* `UNIQUE(employeeId, locationId)`

**`time_off_requests` table**

| Column | Type | Notes |
| :---- | :---- | :---- |
| `id` | UUID (PK) | |
| `employeeId` | UUID (FK → users) | |
| `locationId` | VARCHAR | |
| `daysRequested` | DECIMAL | |
| `status` | ENUM | PENDING, APPROVED, IN_SYNC, COMPLETED, FAILED, CANCELLED |
| `startDate` | VARCHAR (ISO) | For display |
| `startDateTimestamp` | INTEGER | UNIX epoch for queries |
| `endDate` | VARCHAR (ISO) | For display |
| `endDateTimestamp` | INTEGER | UNIX epoch for queries |
| `hcmReferenceId` | VARCHAR (nullable) | Populated when HCM accepts |
| `rejectionReason` | VARCHAR (nullable) | Populated on FAILED |
| `cancelledBy` | UUID (nullable, FK → users) | Who cancelled, if cancelled |
| `cancelledAt` | VARCHAR (ISO, nullable) | When it was cancelled |
| `manualReviewReason` | VARCHAR (nullable) | Set when HCM reversal of a COMPLETED cancel is rejected. Indexed for operator queries. |
| `idempotencyKey` | VARCHAR | Prevents duplicate submissions |
| `createdAt` | VARCHAR (ISO) | |
| `createdAtTimestamp` | INTEGER | |
| `updatedAt` | VARCHAR (ISO) | |

*Indices:* `UNIQUE(idempotencyKey)`, `INDEX(employeeId, status)`, `INDEX(status)`, `INDEX(employeeId, startDateTimestamp, endDateTimestamp)`, `INDEX(manualReviewReason)`

### Request Status Lifecycle (State Machine)

```
                 ┌──────────┐
    submit       │          │     cancel
   ──────────►   │ PENDING  │  ──────────► CANCELLED
                 │          │
                 └────┬─────┘
                      │ approve
                      ▼
                 ┌──────────┐
                 │ APPROVED │  ──────────► CANCELLED
                 └────┬─────┘
                      │ sync trigger
                      ▼
                 ┌──────────┐
                 │ IN_SYNC  │
                 └────┬─────┘
                  ┌───┴────┐
                  ▼        ▼
           ┌──────────┐ ┌──────┐
           │COMPLETED │ │FAILED│
           └──────────┘ └──────┘
```

**Transition rules:**

| Action | Precondition | Result |
| :---- | :---- | :---- |
| `submit` | Effective balance ≥ daysRequested | → PENDING |
| `approve` | Status = PENDING, actor = MANAGER with role in target location, within graceful period | → APPROVED, triggers HCM sync |
| `reject` | Status = PENDING, actor = MANAGER with role in target location | → CANCELLED |
| `cancel` | Status ∈ {PENDING, APPROVED}, actor = owner or MANAGER with role in target location, within graceful period | → CANCELLED |
| `sync` (auto) | Status = APPROVED | → IN_SYNC → COMPLETED or FAILED |

### Cancellation & Graceful Period

**Graceful Period:** A configurable time window (default: **24 hours before `startDate`**) that governs when certain actions are allowed. After this deadline passes, the system restricts operations to prevent last-minute disruptions.

| Action | Graceful Period Rule |
| :---- | :---- |
| `cancel` (PENDING) | Allowed anytime — no restriction |
| `cancel` (APPROVED, not yet IN_SYNC) | Allowed only if `now < startDate - 24h`. After deadline → requires MANAGER override |
| `cancel` (IN_SYNC or COMPLETED) | Requires HCM rollback. System sends a reversal to HCM API, waits for confirmation, then transitions to CANCELLED. If HCM rejects the reversal, status remains and is flagged for manual review |
| `approve` | Allowed only if `now < startDate - 24h`. After deadline → auto-rejected with reason `APPROVAL_WINDOW_EXPIRED` |

**Cancellation flow by status:**

1. **PENDING → CANCELLED:** Simple. Release pending deduction from effective balance. No HCM interaction needed.
2. **APPROVED → CANCELLED:** Release pending deduction. If HCM sync had not yet triggered, no HCM interaction. If it was queued, dequeue it.
3. **IN_SYNC → CANCELLED:** The request is mid-flight to the HCM. Wait for HCM response first. If HCM accepted (→ would be COMPLETED), send a reversal request to HCM. If HCM rejected (→ would be FAILED), simply mark CANCELLED.
4. **COMPLETED → CANCELLED:** Send reversal/cancellation request to HCM real-time API. If HCM confirms, mark CANCELLED (balance is restored by the next batch reconciliation). If HCM rejects the reversal, the request **stays COMPLETED** and `manualReviewReason` is persisted with the HCM error message. A `cancel_attempt_failed` audit entry is also written. The service throws `ForbiddenError` to the API client. Operators can list flagged requests with `SELECT * FROM time_off_requests WHERE manualReviewReason IS NOT NULL`.

**Effective balance derivation:**
```
SELECT b.hcmBalance - COALESCE(SUM(r.daysRequested), 0) AS effectiveBalance
FROM employee_balances b
LEFT JOIN time_off_requests r
  ON r.employeeId = b.employeeId
  AND r.locationId = b.locationId
  AND r.status IN ('PENDING', 'APPROVED', 'IN_SYNC')
WHERE b.employeeId = ? AND b.locationId = ?
```

### Edge Cases & Defensive Strategies

**Race condition during batch sync:** The batch dump was generated at time T₁. Local requests created after T₁ must not be double-counted. Fix: `effectiveBalance = batchBalance − SUM(requests WHERE status IN (PENDING, APPROVED, IN_SYNC) AND createdAtTimestamp > T₁)`.

**HCM silent failure:** HCM may accept a request but not deduct the balance, or reject without a clear error. Fix: Reconciliation job cross-references COMPLETED requests against the next batch sync. If a COMPLETED request's deduction is missing from the HCM balance, flag it for manual review.

**Optimistic locking on balance updates:** TypeORM's `@VersionColumn()` on `employee_balances`. If the reconciliation job updates the balance at the exact moment an employee submits a request, the DB throws `OptimisticLockVersionMismatchError`. The service catches this, re-reads the balance, and retries.

**HCM downtime:** Approved requests stuck in IN_SYNC are retried with exponential backoff (max 3 retries). After exhaustion, status transitions to FAILED and the pending deduction is released.

### Rejected Alternatives

- **Polling HCM on every balance read** — rejected. Adds latency to every employee-facing query and hammers HCM with requests. Local cache + batch reconciliation is more efficient and resilient.
- **Mutable balance rows (UPDATE in place)** — considered, but optimistic locking via `@VersionColumn` still requires the row to exist. Accepted with version column for concurrency safety.
- **Event sourcing for request lifecycle** — rejected. Adds significant complexity for this scope. A simple status enum with strict state machine validation achieves the same audit trail through `createdAt`/`updatedAt` timestamps.
- **GraphQL** — REST was chosen. Domain operations are transactional and map cleanly to HTTP verbs/status codes. GraphQL was not implemented. Repository design (no joins, flat reads) is compatible with future GraphQL resolver addition if needed.
- **Moment.js for date handling** — rejected. Moment is deprecated and heavy (~300KB). dayjs provides the same API at ~2KB with active maintenance.

## Operational Risks

| Risk | Impact | Mitigation |
| :---- | :---- | :---- |
| HCM API unavailable | Approved requests cannot sync | Retry with exponential backoff; FAILED status after max retries; reconciliation job catches drift |
| Race condition during batch sync | Balance over/under-counted | Timestamp-aware reconciliation formula excludes post-batch requests |
| SQLite "database is locked" under concurrency | Request failures | WAL mode + `busy_timeout` in TypeORM config |
| HCM returns success but doesn't deduct | Phantom balance (employee thinks they have less leave than HCM shows) | Reconciliation job detects mismatch and flags for review |
| Batch sync fails for consecutive days | Growing drift between local and HCM | Critical alert after 2 consecutive failures; system continues operating with stale data + warning banner |

## Implementation Plan & Module Structure

### Setup & Initialization

```bash
npx -y @nestjs/cli new time-off-microservice --package-manager npm --skip-git
cd time-off-microservice
```

Install dependencies:
```bash
# Core
npm i @nestjs/typeorm typeorm better-sqlite3
npm i class-validator class-transformer

# Auth
npm i @nestjs/jwt @nestjs/passport passport passport-jwt

# Utils
npm i dayjs uuid

# Dev
npm i -D @types/jest ts-jest @nestjs/testing @types/better-sqlite3 @types/passport-jwt
```

### Module Structure

#### 1. Shared Module (`src/shared/`)
```text
src/shared/
├── base/
│   ├── base.repository.ts              # Abstract generic repo (findById, findMany, save, etc.)
│   ├── base.repository.interface.ts    # IBaseRepository<T>
│   └── __tests__/
│       └── base.repository.spec.ts
├── exceptions/
│   ├── base.error.ts                   # extends Error: code, details, httpStatus
│   ├── insufficient-balance.error.ts
│   ├── unauthorized-location.error.ts
│   ├── hcm-unavailable.error.ts
│   ├── request-state-conflict.error.ts
│   ├── graceful-period-expired.error.ts
│   ├── hcm-rollback-failed.error.ts
│   ├── not-found.error.ts
│   ├── forbidden.error.ts
│   ├── invalid-date-range.error.ts
│   ├── optimistic-lock.error.ts
│   ├── overlap-conflict.error.ts
│   ├── index.ts
│   └── __tests__/
│       ├── base.error.spec.ts
│       └── domain-errors.spec.ts
├── interfaces/
│   ├── actor.interface.ts              # IActor { id, role, locationIds, managedLocationIds }
│   ├── paginated.interface.ts          # IPaginated<T>
│   └── index.ts
├── types/
│   ├── request-status.enum.ts
│   ├── role.enum.ts
│   └── index.ts
├── utils/
│   ├── date.util.ts                    # dayjs UTC wrapper: computeDays, toUTC, toTimestamp
│   ├── uuid.util.ts
│   └── __tests__/
│       ├── date.util.spec.ts
│       └── uuid.util.spec.ts
├── filters/
│   ├── global-exception.filter.ts      # Maps BaseError → HTTP response
│   └── __tests__/
│       └── global-exception.filter.spec.ts
└── shared.module.ts
```

#### 2. Auth & RBAC Module (`src/auth/`)
```text
src/auth/
├── interfaces/
│   ├── jwt-payload.interface.ts
│   └── index.ts
├── guards/
│   ├── jwt.guard.ts                    # Validates Bearer token
│   ├── roles.guard.ts                  # @Roles('EMPLOYEE', 'MANAGER')
│   ├── location-access.guard.ts        # Validates actor belongs to target locationId
│   └── __tests__/
│       ├── jwt.guard.spec.ts
│       ├── roles.guard.spec.ts
│       └── location-access.guard.spec.ts
├── decorators/
│   ├── current-actor.decorator.ts      # @CurrentActor() → IActor
│   ├── roles.decorator.ts             # @Roles(...roles)
│   └── __tests__/
│       └── current-actor.decorator.spec.ts
├── strategies/
│   ├── jwt.strategy.ts
│   └── __tests__/
│       └── jwt.strategy.spec.ts
└── auth.module.ts
```

#### 3. Database Module (`src/database/`)
```text
src/database/
├── database.module.ts                  # TypeORM config: WAL mode, busy_timeout
├── data-source.ts                      # DataSource for TypeORM CLI (migration:run, etc.)
├── migrations/
│   ├── 001-create-users.ts
│   ├── 002-create-user-location-roles.ts
│   ├── 003-create-employee-balances.ts
│   ├── 004-create-time-off-requests.ts
│   ├── 005-create-request-audit-log.ts
│   └── 006-add-manual-review-reason.ts # Adds manualReviewReason column + index
└── seed/
    ├── seed.service.ts                 # OnModuleInit — idempotent seed in dev
    └── seed.module.ts
```

**Indexing strategy** (beyond PKs and unique constraints):
- `users`: `UNIQUE(email)`
- `user_location_roles`: `UNIQUE(userId, locationId, role)`, `INDEX(userId)`, `INDEX(locationId, role)`
- `employee_balances`: `UNIQUE(employeeId, locationId)`
- `time_off_requests`: `UNIQUE(idempotencyKey)`, `INDEX(employeeId, status)`, `INDEX(status)`, `INDEX(employeeId, startDateTimestamp, endDateTimestamp)`, `INDEX(manualReviewReason)`
- `request_audit_log`: `INDEX(requestId)`, `INDEX(actorId)`

#### 4. User Module (`src/user/`)
```text
src/user/
├── entities/
│   ├── user.entity.ts
│   └── user-location-role.entity.ts
├── interfaces/
│   ├── user.repository.interface.ts
│   ├── user-role.repository.interface.ts
│   ├── user.service.interface.ts
│   └── index.ts
├── dto/
│   ├── create-user.input.ts
│   ├── assign-role.input.ts
│   ├── user.output.ts
│   └── index.ts
├── repositories/
│   ├── user.repository.ts              # UserRepository (read) — extends BaseRepository
│   ├── user.write.repository.ts        # UserWriteRepository (write) — standalone
│   ├── user-role.repository.ts         # UserRoleRepository (unified) — join table, no split needed
│   └── __tests__/
│       ├── user.repository.spec.ts
│       └── user-role.repository.spec.ts
├── services/
│   ├── user.service.ts                 # implements IUserService — reads via UserRepository, writes via UserWriteRepository
│   └── __tests__/
│       └── user.service.spec.ts
├── user.controller.ts
├── user.module.ts
└── __tests__/
    └── user.controller.spec.ts
```

#### 5. Balance Module (`src/balance/`)
```text
src/balance/
├── entities/
│   └── balance.entity.ts
├── interfaces/
│   ├── balance-read.repository.interface.ts
│   ├── balance-write.repository.interface.ts
│   ├── balance.service.interface.ts
│   └── index.ts
├── dto/
│   ├── balance-query.input.ts
│   ├── effective-balance.output.ts
│   └── index.ts
├── repositories/
│   ├── balance.read.repository.ts      # extends BaseRepository, implements IBalanceReadRepository
│   ├── balance.write.repository.ts     # implements IBalanceWriteRepository
│   └── __tests__/
│       ├── balance.read.repository.spec.ts
│       └── balance.write.repository.spec.ts
├── services/
│   ├── balance.service.ts              # implements IBalanceService
│   └── __tests__/
│       └── balance.service.spec.ts
├── balance.controller.ts
├── balance.module.ts
└── __tests__/
    └── balance.controller.spec.ts
```

#### 6. Request Module (`src/request/`)
```text
src/request/
├── entities/
│   ├── time-off-request.entity.ts
│   └── request-audit.entity.ts
├── interfaces/
│   ├── request-read.repository.interface.ts
│   ├── request-write.repository.interface.ts
│   ├── request.service.interface.ts
│   ├── state-machine.interface.ts
│   └── index.ts
├── dto/
│   ├── submit-request.input.ts
│   ├── reject-request.input.ts
│   ├── requests-filter.input.ts
│   ├── request.output.ts
│   ├── approve-reject.output.ts
│   └── index.ts
├── repositories/
│   ├── request.read.repository.ts      # RequestReadRepository — queries and lookups
│   ├── request.write.repository.ts     # RequestWriteRepository — kept for reference; mutations now go through DataSource.transaction() in RequestService
│   ├── request-audit.repository.ts     # buildEntity() + logTransition() — audit log factory
│   └── __tests__/
│       ├── request.read.repository.spec.ts
│       └── request.write.repository.spec.ts
├── guards/
│   ├── request-location.guard.ts       # Loads request by :id and checks actor has role at its locationId (defense-in-depth)
│   └── __tests__/
│       └── request-location.guard.spec.ts
├── services/
│   ├── request.service.ts              # All mutations wrapped in DataSource.transaction() (status + audit atomic). Sets manualReviewReason on HCM reversal failure.
│   ├── request-state-machine.ts
│   └── __tests__/
│       ├── request.service.spec.ts
│       └── request-state-machine.spec.ts
├── request.controller.ts
├── request.module.ts
└── __tests__/
    └── request.controller.spec.ts
```

#### 7. HCM Client Module (`src/hcm/`)
```text
src/hcm/
├── interfaces/
│   ├── hcm-client.interface.ts         # IHcmClient
│   └── index.ts
├── dto/
│   ├── hcm-balance-response.dto.ts
│   ├── hcm-submit-timeoff.dto.ts
│   ├── hcm-batch-response.dto.ts
│   └── index.ts
├── hcm.client.ts                       # implements IHcmClient (Anti-Corruption Layer)
├── hcm.module.ts
└── __tests__/
    └── hcm.client.spec.ts
```

#### 9. Webhook Module (`src/webhook/`)
```text
src/webhook/
├── dto/
│   └── hcm-webhook.dto.ts              # HcmBalanceWebhookDto: employeeId, locationId, balance, generatedAt, generatedAtTimestamp
├── webhook.controller.ts               # POST /webhooks/hcm/balance — validates X-Webhook-Secret, calls BalanceService
└── webhook.module.ts
```

**Endpoint:** `POST /api/webhooks/hcm/balance`
**Auth:** `X-Webhook-Secret` header (compared against `WEBHOOK_SECRET` env var). If `WEBHOOK_SECRET` is empty, validation is skipped (useful for local dev).
**Body:** `{ employeeId, locationId, balance, generatedAt, generatedAtTimestamp }`
**Response:** `200 { received: true }`

#### 10. Seed Module (`src/database/seed/`)
```text
src/database/seed/
├── seed.service.ts                     # OnModuleInit — seeds DB on first start (dev only)
└── seed.module.ts
```

Seed data created on first `npm run start:dev` (skipped if any user already exists):
| Email | Role | Location | Balance |
|---|---|---|---|
| `manager@company.com` | MANAGER | loc-001, loc-002 | — |
| `alice@company.com` | EMPLOYEE | loc-001 | 20 days |
| `bob@company.com` | EMPLOYEE | loc-001 | 20 days |

Password for all users: `Password123`

#### 8. Sync Module (`src/sync/`)
```text
src/sync/
├── interfaces/
│   ├── sync.service.interface.ts
│   └── index.ts
├── sync.service.ts                     # implements ISyncService: real-time + batch reconciliation
├── sync.cron.ts                        # @Cron for nightly batch job
├── sync.module.ts
└── __tests__/
    ├── sync.service.spec.ts
    └── sync.cron.spec.ts
```

#### 9. Mock HCM Server (`test/mock-hcm/`)
```text
test/mock-hcm/
├── mock-hcm.module.ts
├── mock-hcm.controller.ts
├── mock-hcm.service.ts                 # In-memory balance store with simulation logic
└── mock-hcm.e2e-spec.ts
```

**Mock HCM endpoints:**
- `GET /mock-hcm/balances?employeeId=X&locationId=Y` → Returns `{ balance, updatedAt }`
- `POST /mock-hcm/time-off` → Deducts balance; returns `201` + `hcmReferenceId` or `422` if insufficient
- `GET /mock-hcm/batch` → Full balance dump with `generatedAt` timestamp
- Supports `X-Simulate-Timeout: true` header to test resilience (delays 15s)
- Supports `X-Simulate-Error: true` header to test HCM failure paths

#### 10. Config & Tooling (Project Root)
```text
.env.example          # All env vars with placeholders
.eslintrc.js          # NestJS recommended rules
.prettierrc           # Consistent formatting
jest.config.ts        # Unit + E2E test projects config
tsconfig.json         # Strict mode enabled
README.md             # Setup, run, test instructions
```

## Execution Order

| # | Phase | Depends On | Est. Files |
|---|---|---|---|
| 1 | Project scaffold + deps | — | ~5 |
| 2 | Shared module (BaseRepo, BaseError, exceptions, utils, types, enums, filters) | 1 | ~30 |
| 3 | Auth module (JWT, RBAC guards, location guard, decorators) | 2 | ~14 |
| 4 | Database module + migrations (users, roles, balances, requests, audit) | 2 | ~7 |
| 5 | User module (entities, repos, service, controller + tests) | 3, 4 | ~16 |
| 6 | Balance module (entity, repos, service, controller + tests) | 3, 4, 5 | ~14 |
| 7 | Request module (entities, repos, state machine, graceful period, service, controller + tests) | 3, 4, 5, 6 | ~24 |
| 8 | HCM client module + tests | 2 | ~8 |
| 9 | Sync module (real-time + batch cron) + tests | 6, 7, 8 | ~8 |
| 10 | Mock HCM server + E2E integration tests | All | ~15 |
| 11 | Config, tooling, README | All | ~6 |

**Total: ~147 files**

## Test Strategy

### Unit Tests
Every source file with runtime behavior must have a companion `.spec.ts` in the `__tests__/` folder of its module. Entities, DTOs, migrations, and the DataSource config are excluded from coverage (pure data/config without logic).

Target: **≥ 90% statement coverage**. Current: 97.96% statements / 95.3% methods / 79.32% branches over 221 tests.
```bash
npm run test
```

Key scenarios:
- Balance calculation correctly excludes CANCELLED/FAILED requests
- State machine rejects illegal transitions (e.g., COMPLETED → PENDING)
- Exception hierarchy returns correct HTTP status codes
- RBAC guards reject unauthorized roles and locations

### E2E / Integration Tests
Run against in-memory SQLite + Mock HCM server. Simulate full business flows:
```bash
npm run test:e2e
```

Key scenarios:
- **Happy path:** Submit → Approve → HCM Sync → COMPLETED
- **HCM rejection:** Submit → Approve → HCM returns 422 → FAILED, balance restored
- **Concurrent requests:** Two requests exhaust balance simultaneously → one succeeds, one fails with `InsufficientBalanceError`
- **Batch reconciliation:** Inject silent HCM balance change → trigger batch → verify local balance updated without double-counting in-flight requests
- **HCM timeout:** Submit → Approve → HCM simulates timeout → retry logic → eventual FAILED
- **RBAC enforcement:** Employee tries to approve own request → 403; Manager tries to approve request in wrong location → 403
- **Cancel PENDING:** Submit → Cancel → balance fully restored, no HCM call
- **Cancel APPROVED within graceful period:** Submit → Approve → Cancel (before 48h deadline) → CANCELLED, HCM sync dequeued
- **Cancel APPROVED after graceful period:** Submit → Approve → Cancel (after deadline) → rejected unless MANAGER override
- **Cancel COMPLETED (HCM rollback):** Submit → Approve → Sync → COMPLETED → Cancel → HCM reversal sent → CANCELLED if confirmed, stays COMPLETED if HCM rejects
- **Approve after graceful period expired:** Submit → wait beyond 48h before startDate → Approve → rejected with `APPROVAL_WINDOW_EXPIRED`
- **User role validation:** User with EMPLOYEE role in location A tries to submit request for location B → 403

### Coverage Report
```bash
npm run test:cov
```

### Lint + Format Check
```bash
npm run lint
npm run format:check
```

## Migration (Production)

In production (`NODE_ENV=production`) the app does **not** auto-synchronize the schema. Use the TypeORM CLI instead:

```bash
# Apply all pending migrations
npm run migration:run

# Roll back the last migration
npm run migration:revert

# Show which migrations have been applied
npm run migration:show

# Generate a new migration from entity changes
npm run migration:generate -- src/database/migrations/006-your-name
```

The CLI reads `src/database/data-source.ts`, which loads `.env` via `dotenv`. Set `DB_PATH` to your production database path before running.

New environment variables:

| Variable | Default | Description |
|---|---|---|
| `WEBHOOK_SECRET` | `""` | Secret header value for HCM webhook. Leave empty to skip validation in dev. |
| `HCM_PATH_PREFIX` | `/mock-hcm` | Base path prefix for all HCM endpoints. Internal routes (`/balances`, `/time-off`, `/time-off/:id/cancel`, `/batch`) are relative to this prefix. For a real HCM, override this to the appropriate API base path. |

## Open Questions

1. Should the batch reconciliation run nightly, or should it be configurable per-tenant?
2. What happens if the batch sync fails for multiple consecutive days — pause new requests or continue with stale data + alerts?
3. Are there additional dimensions beyond `employeeId` and `locationId` required by the HCM?
4. Should managers be able to override a system rejection when effective balance is negative?

## Security/Compliance Notes

- **RBAC enforcement:** All endpoints require JWT verification. Managers can only approve/reject requests for locations they manage. Employees can only view their own balances and requests.
- **Location isolation:** The `LocationAccessGuard` cross-references the actor's `managedLocationIds` (or `locationId` for employees) against the target resource before allowing access.
- **Idempotency:** Duplicate request submissions (same `idempotencyKey`) return the existing record instead of creating a new one.
- **Audit trail:** Every state transition is logged in `request_audit_log` with actor ID, timestamp, previous status, and new status.
