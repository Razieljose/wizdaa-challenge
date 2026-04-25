/**
 * DTO for HCM balance query response.
 * Maps the HCM API response to our domain model.
 */
export class HcmBalanceResponseDto {
  employeeId: string;
  locationId: string;
  balance: number;
  updatedAt: string;
}
