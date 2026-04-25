import { RequestStatus } from '../../shared/types';

/**
 * Interface for the request state machine.
 * Enforces strict transition rules per TRD.
 */
export interface IStateMachine {
  /**
   * Validates whether a transition from currentStatus to newStatus is allowed.
   * Throws RequestStateConflictError if the transition is invalid.
   */
  validateTransition(currentStatus: RequestStatus, action: string): RequestStatus;

  /**
   * Returns all valid transitions from a given status.
   */
  getValidActions(currentStatus: RequestStatus): string[];
}
