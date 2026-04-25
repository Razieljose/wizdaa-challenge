import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SyncService } from './sync.service';

/**
 * Cron jobs for sync operations:
 * 1. Nightly batch reconciliation
 * 2. Periodic processing of approved requests (real-time fallback)
 */
@Injectable()
export class SyncCron {
  private readonly logger = new Logger(SyncCron.name);

  constructor(private readonly syncService: SyncService) {}

  /**
   * Nightly batch reconciliation at 2:00 AM.
   * Pulls full HCM balance dump and reconciles local records.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleBatchReconciliation(): Promise<void> {
    this.logger.log('Cron: Starting nightly batch reconciliation');
    try {
      await this.syncService.runBatchReconciliation();
      this.logger.log('Cron: Batch reconciliation completed');
    } catch (error) {
      this.logger.error(`Cron: Batch reconciliation failed: ${error.message}`);
    }
  }

  /**
   * Process approved requests every 5 minutes as a fallback
   * in case real-time sync was missed.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleApprovedRequestsSync(): Promise<void> {
    this.logger.debug('Cron: Checking for approved requests to sync');
    try {
      await this.syncService.processApprovedRequests();
    } catch (error) {
      this.logger.error(`Cron: Failed to process approved requests: ${error.message}`);
    }
  }
}
