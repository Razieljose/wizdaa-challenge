export interface ISyncService {
  /**
   * Real-time sync: pushes an approved request to HCM.
   * Transitions: APPROVED → IN_SYNC → COMPLETED or FAILED.
   */
  syncRequestToHcm(requestId: string): Promise<void>;

  /**
   * Batch reconciliation: pulls full balance dump from HCM
   * and reconciles local records without double-counting in-flight requests.
   */
  runBatchReconciliation(): Promise<void>;
}
