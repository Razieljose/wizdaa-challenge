import { Injectable } from '@nestjs/common';
import { IStateMachine } from '../interfaces/state-machine.interface';
import { RequestStatus } from '../../shared/types';
import { RequestStateConflictError } from '../../shared/exceptions';

/**
 * Strict state machine for time-off request lifecycle.
 * Follows TRD transition rules exactly:
 * 
 * PENDING   -> approve -> APPROVED
 * PENDING   -> reject  -> CANCELLED
 * PENDING   -> cancel  -> CANCELLED
 * APPROVED  -> sync    -> IN_SYNC
 * APPROVED  -> cancel  -> CANCELLED
 * IN_SYNC   -> complete -> COMPLETED
 * IN_SYNC   -> fail     -> FAILED
 * IN_SYNC   -> cancel   -> CANCELLED (with HCM rollback)
 * COMPLETED -> cancel   -> CANCELLED (with HCM reversal)
 */
@Injectable()
export class RequestStateMachine implements IStateMachine {
  private readonly transitions: Map<RequestStatus, Map<string, RequestStatus>> = new Map([
    [
      RequestStatus.PENDING,
      new Map<string, RequestStatus>([
        ['approve', RequestStatus.APPROVED],
        ['reject', RequestStatus.CANCELLED],
        ['cancel', RequestStatus.CANCELLED],
      ]),
    ],
    [
      RequestStatus.APPROVED,
      new Map<string, RequestStatus>([
        ['sync', RequestStatus.IN_SYNC],
        ['cancel', RequestStatus.CANCELLED],
      ]),
    ],
    [
      RequestStatus.IN_SYNC,
      new Map<string, RequestStatus>([
        ['complete', RequestStatus.COMPLETED],
        ['fail', RequestStatus.FAILED],
        ['cancel', RequestStatus.CANCELLED],
      ]),
    ],
    [
      RequestStatus.COMPLETED,
      new Map<string, RequestStatus>([
        ['cancel', RequestStatus.CANCELLED],
      ]),
    ],
    // Terminal states: no transitions allowed
    [RequestStatus.FAILED, new Map()],
    [RequestStatus.CANCELLED, new Map()],
  ]);

  validateTransition(currentStatus: RequestStatus, action: string): RequestStatus {
    const statusTransitions = this.transitions.get(currentStatus);

    if (!statusTransitions) {
      throw new RequestStateConflictError('unknown', currentStatus, action);
    }

    const newStatus = statusTransitions.get(action);

    if (!newStatus) {
      throw new RequestStateConflictError('unknown', currentStatus, action);
    }

    return newStatus;
  }

  getValidActions(currentStatus: RequestStatus): string[] {
    const statusTransitions = this.transitions.get(currentStatus);
    if (!statusTransitions) {
      return [];
    }
    return Array.from(statusTransitions.keys());
  }
}
