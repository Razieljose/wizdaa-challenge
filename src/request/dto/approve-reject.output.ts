import { RequestStatus } from '../../shared/types';

export class ApproveRejectOutput {
  requestId: string;
  previousStatus: RequestStatus;
  newStatus: RequestStatus;
  message: string;
}
