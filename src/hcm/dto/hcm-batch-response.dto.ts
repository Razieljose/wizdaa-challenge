/**
 * DTO for a single entry in the HCM batch balance dump.
 */
export class HcmBatchBalanceEntryDto {
  employeeId: string;
  locationId: string;
  balance: number;
}

/**
 * DTO for the full HCM batch balance dump response.
 */
export class HcmBatchResponseDto {
  generatedAt: string;
  generatedAtTimestamp: number;
  balances: HcmBatchBalanceEntryDto[];
}
