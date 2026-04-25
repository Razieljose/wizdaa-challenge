export interface IHcmBalanceResponse {
  employeeId: string;
  locationId: string;
  balance: number;
  updatedAt: string;
}

export interface IHcmSubmitTimeOffRequest {
  employeeId: string;
  locationId: string;
  daysRequested: number;
  startDate: string;
  endDate: string;
  referenceId: string;
}

export interface IHcmSubmitTimeOffResponse {
  hcmReferenceId: string;
  status: 'ACCEPTED' | 'REJECTED';
  message?: string;
}

export interface IHcmCancelResponse {
  status: 'CONFIRMED' | 'REJECTED';
  message?: string;
}

export interface IHcmBatchBalanceEntry {
  employeeId: string;
  locationId: string;
  balance: number;
}

export interface IHcmBatchResponse {
  generatedAt: string;
  generatedAtTimestamp: number;
  balances: IHcmBatchBalanceEntry[];
}

/**
 * Anti-Corruption Layer interface for HCM communication.
 * Isolates domain from HCM API specifics.
 */
export interface IHcmClient {
  /**
   * Get the real-time balance for an employee at a location.
   */
  getBalance(employeeId: string, locationId: string): Promise<IHcmBalanceResponse>;

  /**
   * Submit a time-off request to HCM.
   */
  submitTimeOff(request: IHcmSubmitTimeOffRequest): Promise<IHcmSubmitTimeOffResponse>;

  /**
   * Cancel/reverse a previously accepted time-off in HCM.
   */
  cancelTimeOff(hcmReferenceId: string): Promise<IHcmCancelResponse>;

  /**
   * Get the full batch balance dump from HCM.
   */
  getBatchBalances(): Promise<IHcmBatchResponse>;
}
