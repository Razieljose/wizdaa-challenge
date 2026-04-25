import { IActor } from '../../shared/interfaces';
import { SubmitRequestInput, RequestOutput, ApproveRejectOutput } from '../dto';

export interface IRequestService {
  submit(input: SubmitRequestInput, actor: IActor): Promise<RequestOutput>;
  approve(requestId: string, actor: IActor): Promise<ApproveRejectOutput>;
  reject(requestId: string, reason: string, actor: IActor): Promise<ApproveRejectOutput>;
  cancel(requestId: string, actor: IActor): Promise<ApproveRejectOutput>;
  findById(requestId: string): Promise<RequestOutput>;
  findByEmployee(employeeId: string, locationId?: string): Promise<RequestOutput[]>;
}
