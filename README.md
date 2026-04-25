# Time-Off Microservice

Time-off management microservice built with **NestJS 11**, **SQLite**, and **TypeORM 0.3**. Implements the full lifecycle of time-off requests with a state machine, RBAC per location, HCM synchronization, and batch reconciliation.

---

## Prerequisites

| Tool | Minimum version |
|---|---|
| Node.js | 18.x |
| npm | 9.x |

No Docker, no Redis, no external database — just Node + a local SQLite file.

---

## Setup

```bash
cd time-off-microservice
npm install
```

The `.env` file already ships with development values. Edit it directly to customize.

**Environment variables:**

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment (`development` / `production`) |
| `JWT_SECRET` | `dev-secret-key-not-for-production` | JWT secret — change in production |
| `JWT_EXPIRES_IN` | `8h` | Token expiration |
| `DB_PATH` | `./data/timeoff.db` | SQLite database path |
| `DB_LOGGING` | `false` | SQL query logging (`true` / `false`) |
| `HCM_BASE_URL` | `http://localhost:3001` | Base URL of the HCM system |
| `HCM_PATH_PREFIX` | `/mock-hcm` | Prefix for HCM paths. Internal routes (`/balances`, `/time-off`, `/time-off/:id/cancel`, `/batch`) are relative to it. Override when pointing to a real production HCM. |
| `HCM_TIMEOUT_MS` | `10000` | HCM request timeout (ms) |
| `HCM_MAX_RETRIES` | `3` | Retries with exponential backoff (1s, 2s, 4s) |
| `GRACE_PERIOD_HOURS` | `24` | Grace period window before `startDate` |
| `WEBHOOK_SECRET` | `dev-webhook-secret-change-me` | Secret used to authenticate HCM webhooks (empty = disabled) |

---

## Running

```bash
# Development (hot-reload, schema auto-sync, automatic seed)
npm run start:dev

# Production (run migration:run beforehand)
npm run build
npm run start:prod
```

On the **first development run**, the database is created at `./data/timeoff.db` and automatically populated with:

| User | Role | Location | Password |
|---|---|---|---|
| `manager@company.com` | MANAGER | loc-001, loc-002 | `Password123` |
| `alice@company.com` | EMPLOYEE | loc-001 | `Password123` |
| `bob@company.com` | EMPLOYEE | loc-001 | `Password123` |

The seed is idempotent: if the database already contains users, it is skipped.

---

## Migrations (production)

In production (`NODE_ENV=production`) the schema is **not auto-synchronized**. Use the migration scripts:

```bash
# Apply all pending migrations
npm run migration:run

# Revert the last migration
npm run migration:revert

# Show migration status
npm run migration:show

# Generate a new migration from entity changes
npm run migration:generate -- src/database/migrations/006-your-migration-name
```

Migrations live in `src/database/migrations/` and the CLI configuration lives in `src/database/data-source.ts`.

---

## API

All endpoints are prefixed with `/api`. The server listens on port `3000` by default.

### Users and Authentication

| Method | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/api/users` | — | Create user |
| `POST` | `/api/users/login` | — | Login — returns JWT `accessToken` |
| `POST` | `/api/users/roles` | JWT + MANAGER | Assign role to user per location |
| `GET` | `/api/users/:id` | JWT | Fetch user by ID |

### Balances

| Method | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/api/balances?employeeId=X&locationId=Y` | JWT + location | Get effective balance |

Effective balance is calculated in real time:
```
effectiveBalance = hcmBalance − SUM(daysRequested WHERE status IN PENDING, APPROVED, IN_SYNC)
```

### `manualReviewReason` field

Every `RequestOutput` returned by the API includes a `manualReviewReason: string | null` field. Possible values:
- `null` — no pending review (normal case)
- `"HCM_REVERSAL_REJECTED:<message>"` — a cancellation attempt for a COMPLETED request was rejected by HCM. The request stays COMPLETED until manual resolution.

### Time-Off Requests

| Method | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/api/requests` | JWT + EMPLOYEE/MANAGER + location | Submit a request |
| `PATCH` | `/api/requests/:id/approve` | JWT + MANAGER | Approve |
| `PATCH` | `/api/requests/:id/reject` | JWT + MANAGER | Reject |
| `PATCH` | `/api/requests/:id/cancel` | JWT | Cancel (owner or MANAGER) |
| `GET` | `/api/requests/:id` | JWT | Fetch a request by ID |
| `GET` | `/api/requests?employeeId=X` | JWT | List an employee's requests |

### HCM Webhook

| Method | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/api/webhooks/hcm/balance` | `X-Webhook-Secret` | Receive a balance update from HCM |

Expected payload:
```json
{
  "employeeId": "uuid",
  "locationId": "loc-001",
  "balance": 18,
  "generatedAt": "2026-01-01T00:00:00Z",
  "generatedAtTimestamp": 1735689600
}
```

---

## Quick Walkthrough (Thunder Client / Postman)

```
1. POST /api/users/login          → { accessToken }
2. POST /api/requests             → { id }   (header: Authorization: Bearer <token>)
3. PATCH /api/requests/:id/approve
4. GET  /api/balances?employeeId=...&locationId=...
```

---

## Request State Machine

```
                    submit
                  ──────────► PENDING ──cancel──► CANCELLED
                                 │
                              approve
                                 │
                              APPROVED ──cancel──► CANCELLED
                                 │
                          sync (cron 5min)
                                 │
                              IN_SYNC ──cancel──► CANCELLED
                              ┌──┴──┐
                           complete  fail
                              │       │
                          COMPLETED  FAILED
                              │
                        cancel (with HCM reversal)
                              │
                           CANCELLED
```

**Grace period** (default: 24h before `startDate`):
- `approve`: allowed only within the grace period
- `cancel` of APPROVED by an employee: allowed only within the grace period
- `cancel` of APPROVED by a MANAGER: always allowed

**Cancel of COMPLETED**: sends a reversal to HCM. If HCM confirms, the status moves to CANCELLED. If HCM rejects, the request stays COMPLETED, the `manualReviewReason` field is filled with `HCM_REVERSAL_REJECTED:<message>`, and a `cancel_attempt_failed` audit entry is recorded. The API returns `403 ForbiddenError`. Operators list pending cases with:

```sql
SELECT * FROM time_off_requests WHERE manualReviewReason IS NOT NULL;
```

---

## RBAC

Each user has roles per location (`user_location_roles`). At authentication time, the JWT strategy loads all roles and builds the `IActor` with:
- `roles[]` — list of `{ locationId, role }`
- `employeeLocationIds[]` — locations where the actor holds the EMPLOYEE role
- `managedLocationIds[]` — locations where the actor holds the MANAGER role

Guards applied per endpoint:

| Endpoint | Guards |
|---|---|
| `POST /requests` | `JwtGuard` → `RolesGuard` → `LocationAccessGuard` |
| `PATCH /requests/:id/approve` | `JwtGuard` → `RolesGuard(MANAGER)` → `RequestLocationGuard` |
| `PATCH /requests/:id/reject` | `JwtGuard` → `RolesGuard(MANAGER)` → `RequestLocationGuard` |
| `PATCH /requests/:id/cancel` | `JwtGuard` → `RequestLocationGuard` |
| `GET /requests/:id` | `JwtGuard` → `RequestLocationGuard` |
| `GET /balances` | `JwtGuard` → `LocationAccessGuard` |

- `RolesGuard` checks `@Roles(...)` against `actor.roles.map(r => r.role)`
- `LocationAccessGuard` extracts `locationId` from body/params/query and validates its presence in `actor.roles`
- `RequestLocationGuard` (defense in depth) loads the request by `:id`, reads its `locationId`, and validates

On top of the guards, the service still runs `validateManagerAccess` (approve/reject) and an owner-or-manager check (cancel) as a second line of defense.

---

## Module Architecture

```
src/
├── shared/          # BaseRepository<T>, BaseError, 11 exceptions, DateUtil, UuidUtil, GlobalExceptionFilter
├── auth/            # JwtStrategy, JwtGuard, RolesGuard, LocationAccessGuard, @CurrentActor, @Roles
├── database/
│   ├── migrations/  # 001–006: 5 tables + manualReviewReason
│   ├── seed/        # SeedService — populates the database on first run (dev only)
│   └── data-source.ts  # DataSource for the migration CLI
├── user/            # UserEntity, UserLocationRoleEntity, UserRepository (read), UserWriteRepository, UserRoleRepository, UserService
├── balance/         # BalanceEntity, BalanceReadRepository, BalanceWriteRepository, BalanceService (optimistic locking)
├── request/         # TimeOffRequestEntity, RequestStateMachine, RequestService (atomic transactions), RequestAuditRepository, RequestLocationGuard
├── hcm/             # HcmClient — ACL with exponential retry (1s/2s/4s), 10s timeout, paths via HCM_PATH_PREFIX
├── sync/            # SyncService (real-time + batch), SyncCron (every_5min + 2AM)
└── webhook/         # WebhookController — POST /webhooks/hcm/balance

test/
├── mock-hcm/        # Mock HCM server for E2E tests (supports X-Simulate-Timeout and X-Simulate-Error)
└── app.e2e-spec.ts  # E2E tests with SQLite :memory:
```

### Architectural patterns

- **Pragmatic CQRS**: the `request`, `balance`, and `user` modules split read and write repositories
- **Atomic transactions**: every status change + audit log entry in `RequestService` runs inside `DataSource.transaction()`
- **Interface-first**: every service and repository implements a dedicated TypeScript interface
- **BaseError hierarchy**: 11 specific exceptions with `code`, `httpStatus`, `details` → mapped by `GlobalExceptionFilter`
- **Dual date columns**: ISO string (display) + UNIX timestamp (queries) on every entity that has dates
- **Optimistic locking**: `@VersionColumn` on `BalanceEntity` with a retry loop (up to 3x)
- **WAL mode**: `PRAGMA journal_mode=WAL` + `busy_timeout=5000` for concurrent reads on SQLite

---

## Database

### Tables and Indices

| Table | Relevant indices |
|---|---|
| `users` | `UNIQUE(email)` |
| `user_location_roles` | `UNIQUE(userId, locationId, role)`, `INDEX(userId)`, `INDEX(locationId, role)` |
| `employee_balances` | `UNIQUE(employeeId, locationId)`, `@VersionColumn` |
| `time_off_requests` | `UNIQUE(idempotencyKey)`, `INDEX(employeeId, status)`, `INDEX(status)`, `INDEX(employeeId, startDateTimestamp, endDateTimestamp)`, `INDEX(manualReviewReason)` |
| `request_audit_log` | `INDEX(requestId)`, `INDEX(actorId)` |

---

## Tests

```bash
# Unit tests (all modules)
npm run test

# Unit tests in watch mode
npm run test:watch

# E2E tests (in-memory SQLite + mock HCM)
npm run test:e2e

# Code coverage
npm run test:cov

# Check formatting (read-only)
npm run format:check

# Lint
npm run lint
```

### Current coverage

Latest run: **97.96% statements**, **98.04% lines**, **95.3% methods**, **79.32% branches** — 221 tests passing across 32 suites.

Files excluded from coverage (via `jest.config.json`): `*.module.ts`, `main.ts`, `*.interface.ts`, `index.ts`, `database/migrations/**`, `database/data-source.ts`, `**/dto/**`, `**/entities/**`. These files are pure configuration or contain only TypeORM / class-validator decorators, with no runtime logic to test.

### Test structure

Every implementation file has a matching `.spec.ts` inside the `__tests__/` folder of its module. E2E tests use the embedded mock HCM server (no external server required).

---

## Technical Decisions

See [docs/decisions.md](./docs/decisions.md) for the full log of decisions and TRD ambiguity resolutions.

Key decisions:
- **WAL mode configured in two places** (TypeORM `extra.pragma` + a direct `PRAGMA` in `main.ts`) — intentional redundancy to guarantee activation
- **Sync is not immediate on approve** — a 5-minute cron acts as a fallback; avoids blocking the HTTP response
- **HCM paths configurable via `HCM_PATH_PREFIX`** — defaults to `/mock-hcm` for development; override in production
- **Cancel of COMPLETED with HCM failure** — the request stays COMPLETED, `manualReviewReason` is persisted along with a `cancel_attempt_failed` audit entry, the client receives 403, and operators list pending cases via SQL
- **Atomic transactions on every request mutation** — status + audit log always run inside `DataSource.transaction()`
- **Defense in depth on request endpoints** — `RequestLocationGuard` at the controller + `validateManagerAccess` at the service
- **Unified `UserRoleRepository`** — simple join table; splitting read/write would be boilerplate with no real benefit
- **Entities and DTOs excluded from coverage** — they only carry TypeORM / class-validator decorators with no runtime logic
