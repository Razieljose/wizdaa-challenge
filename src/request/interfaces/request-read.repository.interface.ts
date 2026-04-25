import { IBaseRepository } from '../../shared/base/base.repository.interface';
import { TimeOffRequestEntity } from '../entities/time-off-request.entity';
import { RequestStatus } from '../../shared/types';

export interface IRequestReadRepository extends IBaseRepository<TimeOffRequestEntity> {
  findByIdempotencyKey(key: string): Promise<TimeOffRequestEntity | null>;
  findByEmployeeAndStatus(employeeId: string, statuses: RequestStatus[]): Promise<TimeOffRequestEntity[]>;
  findOverlapping(
    employeeId: string,
    locationId: string,
    startDateTimestamp: number,
    endDateTimestamp: number,
    excludeStatuses: RequestStatus[],
  ): Promise<TimeOffRequestEntity[]>;
  findByStatusIn(statuses: RequestStatus[]): Promise<TimeOffRequestEntity[]>;
  findPendingDeductionsAfterTimestamp(
    employeeId: string,
    locationId: string,
    afterTimestamp: number,
  ): Promise<TimeOffRequestEntity[]>;
  sumPendingDeductions(employeeId: string, locationId: string): Promise<number>;
}
