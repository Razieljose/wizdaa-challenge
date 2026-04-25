import { SyncService } from '../sync.service';
import { RequestStatus } from '../../shared/types';
import { HcmUnavailableError } from '../../shared/exceptions';

describe('SyncService', () => {
  let service: SyncService;
  let mockHcmClient: any;
  let mockRequestService: any;
  let mockRequestReadRepo: any;
  let mockBalanceService: any;
  let mockBalanceReadRepo: any;

  beforeEach(() => {
    mockHcmClient = {
      submitTimeOff: jest.fn(),
      getBatchBalances: jest.fn(),
      cancelTimeOff: jest.fn(),
    };

    mockRequestService = {
      transitionToInSync: jest.fn(),
      transitionToCompleted: jest.fn(),
      transitionToFailed: jest.fn(),
    };

    mockRequestReadRepo = {
      findByStatusIn: jest.fn().mockResolvedValue([]),
    };

    mockBalanceService = {
      updateHcmBalance: jest.fn().mockResolvedValue(undefined),
    };

    mockBalanceReadRepo = {
      findByEmployeeAndLocation: jest.fn(),
    };

    service = new SyncService(
      mockHcmClient,
      mockRequestService,
      mockRequestReadRepo,
      mockBalanceService,
      mockBalanceReadRepo,
    );
  });

  describe('syncRequestToHcm', () => {
    it('should sync successfully: APPROVED → IN_SYNC → COMPLETED', async () => {
      const request = {
        id: 'req-1',
        employeeId: 'emp-1',
        locationId: 'loc-1',
        daysRequested: 3,
        startDate: '2026-06-01',
        endDate: '2026-06-03',
      };

      mockRequestService.transitionToInSync.mockResolvedValue(request);
      mockHcmClient.submitTimeOff.mockResolvedValue({
        status: 'ACCEPTED',
        hcmReferenceId: 'hcm-ref-1',
      });

      await service.syncRequestToHcm('req-1');

      expect(mockRequestService.transitionToInSync).toHaveBeenCalledWith('req-1');
      expect(mockHcmClient.submitTimeOff).toHaveBeenCalled();
      expect(mockRequestService.transitionToCompleted).toHaveBeenCalledWith('req-1', 'hcm-ref-1');
    });

    it('should handle HCM rejection: → FAILED', async () => {
      const request = {
        id: 'req-1',
        employeeId: 'emp-1',
        locationId: 'loc-1',
        daysRequested: 3,
        startDate: '2026-06-01',
        endDate: '2026-06-03',
      };

      mockRequestService.transitionToInSync.mockResolvedValue(request);
      mockHcmClient.submitTimeOff.mockResolvedValue({
        status: 'REJECTED',
        message: 'Insufficient balance in HCM',
      });

      await service.syncRequestToHcm('req-1');

      expect(mockRequestService.transitionToFailed).toHaveBeenCalledWith(
        'req-1',
        expect.stringContaining('HCM rejected'),
      );
    });

    it('should handle HCM timeout/unavailable: → FAILED', async () => {
      const request = {
        id: 'req-1',
        employeeId: 'emp-1',
        locationId: 'loc-1',
        daysRequested: 3,
        startDate: '2026-06-01',
        endDate: '2026-06-03',
      };

      mockRequestService.transitionToInSync.mockResolvedValue(request);
      mockHcmClient.submitTimeOff.mockRejectedValue(
        new HcmUnavailableError({ reason: 'timeout' }),
      );

      await service.syncRequestToHcm('req-1');

      expect(mockRequestService.transitionToFailed).toHaveBeenCalledWith(
        'req-1',
        expect.stringContaining('HCM sync failed'),
      );
    });

    it('should handle IN_SYNC transition failure gracefully', async () => {
      mockRequestService.transitionToInSync.mockRejectedValue(new Error('State conflict'));

      // Should not throw
      await expect(service.syncRequestToHcm('req-1')).resolves.toBeUndefined();
    });
  });

  describe('runBatchReconciliation', () => {
    it('should update local balances from HCM batch', async () => {
      mockHcmClient.getBatchBalances.mockResolvedValue({
        generatedAt: '2026-06-01T02:00:00Z',
        generatedAtTimestamp: 1780000000,
        balances: [
          { employeeId: 'emp-1', locationId: 'loc-1', balance: 18 },
          { employeeId: 'emp-2', locationId: 'loc-1', balance: 25 },
        ],
      });

      await service.runBatchReconciliation();

      expect(mockBalanceService.updateHcmBalance).toHaveBeenCalledTimes(2);
      expect(mockBalanceService.updateHcmBalance).toHaveBeenCalledWith(
        'emp-1', 'loc-1', 18, 1780000000,
      );
      expect(mockBalanceService.updateHcmBalance).toHaveBeenCalledWith(
        'emp-2', 'loc-1', 25, 1780000000,
      );
    });

    it('should handle HCM unavailable without throwing', async () => {
      mockHcmClient.getBatchBalances.mockRejectedValue(
        new HcmUnavailableError({ reason: 'down' }),
      );

      await expect(service.runBatchReconciliation()).resolves.toBeUndefined();
    });

    it('should continue processing other entries when one fails', async () => {
      mockHcmClient.getBatchBalances.mockResolvedValue({
        generatedAt: '2026-06-01T02:00:00Z',
        generatedAtTimestamp: 1780000000,
        balances: [
          { employeeId: 'emp-1', locationId: 'loc-1', balance: 18 },
          { employeeId: 'emp-2', locationId: 'loc-1', balance: 25 },
        ],
      });

      mockBalanceService.updateHcmBalance
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce(undefined);

      await service.runBatchReconciliation();

      // Should still process second entry even after first fails
      expect(mockBalanceService.updateHcmBalance).toHaveBeenCalledTimes(2);
    });
  });

  describe('processApprovedRequests', () => {
    it('should sync all approved requests', async () => {
      mockRequestReadRepo.findByStatusIn.mockResolvedValue([
        { id: 'req-1' },
        { id: 'req-2' },
      ]);

      const request = {
        id: 'req-1',
        employeeId: 'emp-1',
        locationId: 'loc-1',
        daysRequested: 2,
        startDate: '2026-06-01',
        endDate: '2026-06-02',
      };

      mockRequestService.transitionToInSync.mockResolvedValue(request);
      mockHcmClient.submitTimeOff.mockResolvedValue({
        status: 'ACCEPTED',
        hcmReferenceId: 'hcm-ref',
      });

      await service.processApprovedRequests();

      expect(mockRequestService.transitionToInSync).toHaveBeenCalledTimes(2);
    });
  });
});
