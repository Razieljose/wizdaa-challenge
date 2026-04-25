import { RequestStateMachine } from '../request-state-machine';
import { RequestStatus } from '../../../shared/types';
import { RequestStateConflictError } from '../../../shared/exceptions';

describe('RequestStateMachine', () => {
  let sm: RequestStateMachine;

  beforeEach(() => {
    sm = new RequestStateMachine();
  });

  describe('valid transitions', () => {
    it('PENDING → approve → APPROVED', () => {
      expect(sm.validateTransition(RequestStatus.PENDING, 'approve')).toBe(RequestStatus.APPROVED);
    });

    it('PENDING → reject → CANCELLED', () => {
      expect(sm.validateTransition(RequestStatus.PENDING, 'reject')).toBe(RequestStatus.CANCELLED);
    });

    it('PENDING → cancel → CANCELLED', () => {
      expect(sm.validateTransition(RequestStatus.PENDING, 'cancel')).toBe(RequestStatus.CANCELLED);
    });

    it('APPROVED → sync → IN_SYNC', () => {
      expect(sm.validateTransition(RequestStatus.APPROVED, 'sync')).toBe(RequestStatus.IN_SYNC);
    });

    it('APPROVED → cancel → CANCELLED', () => {
      expect(sm.validateTransition(RequestStatus.APPROVED, 'cancel')).toBe(RequestStatus.CANCELLED);
    });

    it('IN_SYNC → complete → COMPLETED', () => {
      expect(sm.validateTransition(RequestStatus.IN_SYNC, 'complete')).toBe(RequestStatus.COMPLETED);
    });

    it('IN_SYNC → fail → FAILED', () => {
      expect(sm.validateTransition(RequestStatus.IN_SYNC, 'fail')).toBe(RequestStatus.FAILED);
    });

    it('IN_SYNC → cancel → CANCELLED', () => {
      expect(sm.validateTransition(RequestStatus.IN_SYNC, 'cancel')).toBe(RequestStatus.CANCELLED);
    });

    it('COMPLETED → cancel → CANCELLED', () => {
      expect(sm.validateTransition(RequestStatus.COMPLETED, 'cancel')).toBe(RequestStatus.CANCELLED);
    });
  });

  describe('invalid transitions', () => {
    it('COMPLETED → approve should throw', () => {
      expect(() => sm.validateTransition(RequestStatus.COMPLETED, 'approve')).toThrow(RequestStateConflictError);
    });

    it('FAILED → approve should throw', () => {
      expect(() => sm.validateTransition(RequestStatus.FAILED, 'approve')).toThrow(RequestStateConflictError);
    });

    it('CANCELLED → approve should throw', () => {
      expect(() => sm.validateTransition(RequestStatus.CANCELLED, 'approve')).toThrow(RequestStateConflictError);
    });

    it('PENDING → complete should throw', () => {
      expect(() => sm.validateTransition(RequestStatus.PENDING, 'complete')).toThrow(RequestStateConflictError);
    });

    it('PENDING → fail should throw', () => {
      expect(() => sm.validateTransition(RequestStatus.PENDING, 'fail')).toThrow(RequestStateConflictError);
    });

    it('APPROVED → approve should throw', () => {
      expect(() => sm.validateTransition(RequestStatus.APPROVED, 'approve')).toThrow(RequestStateConflictError);
    });

    it('FAILED → cancel should throw', () => {
      expect(() => sm.validateTransition(RequestStatus.FAILED, 'cancel')).toThrow(RequestStateConflictError);
    });

    it('CANCELLED → cancel should throw', () => {
      expect(() => sm.validateTransition(RequestStatus.CANCELLED, 'cancel')).toThrow(RequestStateConflictError);
    });

    it('IN_SYNC → approve should throw', () => {
      expect(() => sm.validateTransition(RequestStatus.IN_SYNC, 'approve')).toThrow(RequestStateConflictError);
    });
  });

  describe('getValidActions', () => {
    it('PENDING has approve, reject, cancel', () => {
      const actions = sm.getValidActions(RequestStatus.PENDING);
      expect(actions).toContain('approve');
      expect(actions).toContain('reject');
      expect(actions).toContain('cancel');
    });

    it('FAILED has no valid actions', () => {
      expect(sm.getValidActions(RequestStatus.FAILED)).toEqual([]);
    });

    it('CANCELLED has no valid actions', () => {
      expect(sm.getValidActions(RequestStatus.CANCELLED)).toEqual([]);
    });
  });
});
