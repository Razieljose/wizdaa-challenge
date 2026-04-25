import { SyncCron } from '../sync.cron';

describe('SyncCron', () => {
  let cron: SyncCron;
  let mockSyncService: any;

  beforeEach(() => {
    mockSyncService = {
      runBatchReconciliation: jest.fn().mockResolvedValue(undefined),
      processApprovedRequests: jest.fn().mockResolvedValue(undefined),
    };
    cron = new SyncCron(mockSyncService);
  });

  it('should call runBatchReconciliation on cron trigger', async () => {
    await cron.handleBatchReconciliation();
    expect(mockSyncService.runBatchReconciliation).toHaveBeenCalled();
  });

  it('should call processApprovedRequests on cron trigger', async () => {
    await cron.handleApprovedRequestsSync();
    expect(mockSyncService.processApprovedRequests).toHaveBeenCalled();
  });

  it('should handle errors in batch reconciliation gracefully', async () => {
    mockSyncService.runBatchReconciliation.mockRejectedValue(new Error('Cron error'));
    await expect(cron.handleBatchReconciliation()).resolves.toBeUndefined();
  });

  it('should handle errors in approved sync gracefully', async () => {
    mockSyncService.processApprovedRequests.mockRejectedValue(new Error('Sync error'));
    await expect(cron.handleApprovedRequestsSync()).resolves.toBeUndefined();
  });
});
