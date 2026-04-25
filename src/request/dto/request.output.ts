import { RequestStatus } from '../../shared/types';

export class RequestOutput {
  id: string;
  employeeId: string;
  locationId: string;
  daysRequested: number;
  status: RequestStatus;
  startDate: string;
  endDate: string;
  hcmReferenceId: string | null;
  rejectionReason: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  manualReviewReason: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}
