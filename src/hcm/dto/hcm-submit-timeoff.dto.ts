/**
 * DTO for submitting a time-off request to HCM.
 */
export class HcmSubmitTimeOffDto {
  employeeId: string;
  locationId: string;
  daysRequested: number;
  startDate: string;
  endDate: string;
  referenceId: string;
}

/**
 * DTO for HCM submit time-off response.
 */
export class HcmSubmitTimeOffResponseDto {
  hcmReferenceId: string;
  status: 'ACCEPTED' | 'REJECTED';
  message?: string;
}
