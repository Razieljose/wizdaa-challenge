import { Injectable, Logger } from '@nestjs/common';
import { ISyncService } from './interfaces/sync.service.interface';
import { HcmClient } from '../hcm/hcm.client';
import { RequestService } from '../request/services/request.service';
import { RequestReadRepository } from '../request/repositories/request.read.repository';
import { BalanceService } from '../balance/services/balance.service';
import { BalanceReadRepository } from '../balance/repositories/balance.read.repository';
import { RequestStatus } from '../shared/types';
import { HcmUnavailableError } from '../shared/exceptions';
import { DateUtil } from '../shared/utils/date.util';

/**
 * Sync service handling:
 * 1. Real-time sync of approved requests to HCM
 * 2. Batch reconciliation pulling full HCM dump
 */
@Injectable()
export class SyncService implements ISyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly hcmClient: HcmClient,
    private readonly requestService: RequestService,
    private readonly requestReadRepo: RequestReadRepository,
    private readonly balanceService: BalanceService,
    private readonly balanceReadRepo: BalanceReadRepository,
  ) {}

  /**
   * Real-time sync: pushes an approved request to HCM.
   * APPROVED → IN_SYNC → COMPLETED or FAILED
   */
  async syncRequestToHcm(requestId: string): Promise<void> {
    this.logger.log(`Starting real-time sync for request: ${requestId}`);

    let request;
    try {
      // Transition to IN_SYNC
      request = await this.requestService.transitionToInSync(requestId);
    } catch (error) {
      this.logger.error(`Failed to transition request ${requestId} to IN_SYNC: ${error.message}`);
      return;
    }

    try {
      // Submit to HCM
      const hcmResponse = await this.hcmClient.submitTimeOff({
        employeeId: request.employeeId,
        locationId: request.locationId,
        daysRequested: Number(request.daysRequested),
        startDate: request.startDate,
        endDate: request.endDate,
        referenceId: request.id,
      });

      if (hcmResponse.status === 'ACCEPTED') {
        await this.requestService.transitionToCompleted(requestId, hcmResponse.hcmReferenceId);
        this.logger.log(`Request ${requestId} synced successfully. HCM ref: ${hcmResponse.hcmReferenceId}`);
      } else {
        await this.requestService.transitionToFailed(
          requestId,
          `HCM rejected: ${hcmResponse.message || 'No reason provided'}`,
        );
        this.logger.warn(`Request ${requestId} rejected by HCM: ${hcmResponse.message}`);
      }
    } catch (error) {
      // HCM unavailable after retries → FAILED
      this.logger.error(`HCM sync failed for request ${requestId}: ${error.message}`);
      try {
        await this.requestService.transitionToFailed(
          requestId,
          `HCM sync failed: ${error.message}`,
        );
      } catch (innerError) {
        this.logger.error(`Failed to transition request ${requestId} to FAILED: ${innerError.message}`);
      }
    }
  }

  /**
   * Batch reconciliation: pulls full HCM dump and reconciles local balances.
   * Uses timestamp-aware logic to avoid double-counting requests created after the dump.
   * 
   * Formula: effectiveBalance = batchBalance - SUM(requests WHERE status IN (PENDING, APPROVED, IN_SYNC) AND createdAtTimestamp > T₁)
   * where T₁ is the batch generatedAtTimestamp.
   */
  async runBatchReconciliation(): Promise<void> {
    this.logger.log('Starting batch reconciliation...');

    try {
      const batchResponse = await this.hcmClient.getBatchBalances();
      const batchTimestamp = batchResponse.generatedAtTimestamp;

      this.logger.log(
        `Received batch dump with ${batchResponse.balances.length} entries, generated at ${batchResponse.generatedAt}`,
      );

      for (const entry of batchResponse.balances) {
        try {
          // Update the HCM balance locally
          await this.balanceService.updateHcmBalance(
            entry.employeeId,
            entry.locationId,
            entry.balance,
            batchTimestamp,
          );

          this.logger.debug(
            `Reconciled balance for ${entry.employeeId}/${entry.locationId}: ${entry.balance}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to reconcile balance for ${entry.employeeId}/${entry.locationId}: ${error.message}`,
          );
        }
      }

      this.logger.log('Batch reconciliation completed successfully');
    } catch (error) {
      this.logger.error(`Batch reconciliation failed: ${error.message}`);
      if (error instanceof HcmUnavailableError) {
        this.logger.warn('HCM is unavailable for batch reconciliation. Will retry next cycle.');
      }
    }
  }

  /**
   * Process all approved requests that need HCM sync.
   * Called by cron job or on-demand.
   */
  async processApprovedRequests(): Promise<void> {
    const approvedRequests = await this.requestReadRepo.findByStatusIn([RequestStatus.APPROVED]);
    this.logger.log(`Found ${approvedRequests.length} approved requests to sync`);

    for (const request of approvedRequests) {
      await this.syncRequestToHcm(request.id);
    }
  }
}
