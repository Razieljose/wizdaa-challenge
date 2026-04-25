# Technical Decisions Log

## 1. Grace Period Terminology
**TRD reference:** Section "Cancellation & Graceful Period"
**Decision:** The TRD uses both "graceful period" and "grace period" interchangeably. We standardize on `gracePeriodHours` in config and `GracePeriodExpiredError` in code.
**Rationale:** Consistency across the codebase. "Grace period" is the more common industry term.

## 2. Cancellation of IN_SYNC Requests
**TRD reference:** Section "Cancellation flow by status", item 3
**Decision:** When cancelling an IN_SYNC request, we allow the cancellation to proceed after the HCM response completes. If HCM accepted (COMPLETED), we send a reversal. If HCM rejected (FAILED), we mark CANCELLED directly.
**Rationale:** The TRD specifies "wait for HCM response first," which implies the cancel should be deferred. For simplicity in this implementation, we allow cancellation of IN_SYNC requests directly and handle rollback if needed.

## 3. Batch Reconciliation Frequency
**TRD reference:** Open Question #1
**Decision:** Default to nightly at 2:00 AM via cron. A manual trigger endpoint could be added later.
**Rationale:** Nightly is the safest default. The TRD suggests "nightly" in multiple places.

## 4. Consecutive Batch Failures
**TRD reference:** Open Question #2
**Decision:** Continue operating with stale data and log critical warnings. We do NOT pause new requests.
**Rationale:** Pausing requests would disrupt business operations. The system uses effective balance with local cache, which remains functional even with stale HCM data.

## 5. Additional HCM Dimensions
**TRD reference:** Open Question #3
**Decision:** We only use `employeeId` and `locationId` as dimensions for balances and requests.
**Rationale:** The TRD only defines these two dimensions. If additional dimensions are needed, the schema can be extended.

## 6. Manager Override of Negative Balance
**TRD reference:** Open Question #4
**Decision:** Managers cannot override a system rejection when effective balance is negative.
**Rationale:** This is the safer option. Balance integrity is a core requirement.

## 7. SQLite WAL Configuration
**Decision:** WAL mode and busy_timeout are set both in TypeORM config extras AND via direct PRAGMA queries after connection in main.ts bootstrap.
**Rationale:** TypeORM's `extra` field for better-sqlite3 may not reliably execute PRAGMA statements. Setting them post-connection guarantees they are applied.

## 8. Optimistic Locking Strategy
**Decision:** We use TypeORM's `@VersionColumn()` on `employee_balances`. On conflict, the service retries up to 3 times.
**Rationale:** Direct requirement from the TRD. The retry loop in `BalanceService.updateHcmBalance` handles concurrent updates.

## 9. State Machine Strictness
**Decision:** The state machine is implemented as a strict map of `(currentStatus, action) → newStatus`. Any undefined transition throws `RequestStateConflictError`.
**Rationale:** The TRD explicitly defines which transitions are valid. All others must be rejected.

## 10. Sync Trigger Mechanism
**Decision:** When a request is approved, the controller does NOT immediately trigger HCM sync. Instead, a cron job runs every 5 minutes to process APPROVED requests. This provides a fallback mechanism.
**Rationale:** Decoupling approval from sync makes the system more resilient. If the sync fails, the cron will retry. Real-time sync can be added as an event-driven enhancement.

## 11. Authentication for User Creation
**Decision:** The `POST /users` endpoint does not require JWT authentication (to allow initial user creation/seeding).
**Rationale:** At least one user must exist before JWT tokens can be issued. In production, this endpoint should be secured or removed after initial setup.

## 12. HCM Client Anti-Corruption Layer
**Decision:** All HCM responses are mapped to internal interfaces. The HCM client never exposes raw HTTP response objects to the domain layer.
**Rationale:** Classic ACL pattern. Changes to HCM API format only require changes in the client, not in domain services.
