import { MockHcmService } from './mock-hcm.service';

describe('MockHcmService', () => {
  let service: MockHcmService;

  beforeEach(() => {
    service = new MockHcmService();
  });

  afterEach(() => {
    service.reset();
  });

  describe('balance management', () => {
    it('should set and get balance', () => {
      service.setBalance('emp-1', 'loc-1', 20);
      const balance = service.getBalance('emp-1', 'loc-1');
      expect(balance).not.toBeNull();
      expect(balance!.balance).toBe(20);
    });

    it('should return null for unknown employee', () => {
      expect(service.getBalance('unknown', 'loc-1')).toBeNull();
    });
  });

  describe('submitTimeOff', () => {
    it('should accept and deduct balance', () => {
      service.setBalance('emp-1', 'loc-1', 20);

      const result = service.submitTimeOff({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        daysRequested: 5,
        startDate: '2026-06-01',
        endDate: '2026-06-05',
        referenceId: 'ref-1',
      });

      expect(result.status).toBe('ACCEPTED');
      expect(result.hcmReferenceId).toBeDefined();

      const balance = service.getBalance('emp-1', 'loc-1');
      expect(balance!.balance).toBe(15);
    });

    it('should reject on insufficient balance', () => {
      service.setBalance('emp-1', 'loc-1', 3);

      const result = service.submitTimeOff({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        daysRequested: 5,
        startDate: '2026-06-01',
        endDate: '2026-06-05',
        referenceId: 'ref-1',
      });

      expect(result.status).toBe('REJECTED');
    });

    it('should reject for unknown employee', () => {
      const result = service.submitTimeOff({
        employeeId: 'unknown',
        locationId: 'loc-1',
        daysRequested: 1,
        startDate: '2026-06-01',
        endDate: '2026-06-01',
        referenceId: 'ref-1',
      });

      expect(result.status).toBe('REJECTED');
    });
  });

  describe('cancelTimeOff', () => {
    it('should cancel and restore balance', () => {
      service.setBalance('emp-1', 'loc-1', 20);

      const submitResult = service.submitTimeOff({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        daysRequested: 5,
        startDate: '2026-06-01',
        endDate: '2026-06-05',
        referenceId: 'ref-1',
      });

      expect(service.getBalance('emp-1', 'loc-1')!.balance).toBe(15);

      const cancelResult = service.cancelTimeOff(submitResult.hcmReferenceId!);
      expect(cancelResult.status).toBe('CONFIRMED');
      expect(service.getBalance('emp-1', 'loc-1')!.balance).toBe(20);
    });

    it('should reject cancel for unknown reference', () => {
      const result = service.cancelTimeOff('unknown-ref');
      expect(result.status).toBe('REJECTED');
    });

    it('should reject double cancel', () => {
      service.setBalance('emp-1', 'loc-1', 20);

      const submitResult = service.submitTimeOff({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        daysRequested: 5,
        startDate: '2026-06-01',
        endDate: '2026-06-05',
        referenceId: 'ref-1',
      });

      service.cancelTimeOff(submitResult.hcmReferenceId!);
      const secondCancel = service.cancelTimeOff(submitResult.hcmReferenceId!);
      expect(secondCancel.status).toBe('REJECTED');
    });
  });

  describe('getBatchDump', () => {
    it('should return all balances', () => {
      service.setBalance('emp-1', 'loc-1', 20);
      service.setBalance('emp-2', 'loc-1', 15);

      const dump = service.getBatchDump();
      expect(dump.balances).toHaveLength(2);
      expect(dump.generatedAt).toBeDefined();
      expect(dump.generatedAtTimestamp).toBeGreaterThan(0);
    });

    it('should return empty array when no balances', () => {
      const dump = service.getBatchDump();
      expect(dump.balances).toHaveLength(0);
    });
  });

  describe('reset', () => {
    it('should clear all data', () => {
      service.setBalance('emp-1', 'loc-1', 20);
      service.reset();
      expect(service.getBalance('emp-1', 'loc-1')).toBeNull();
    });
  });
});
