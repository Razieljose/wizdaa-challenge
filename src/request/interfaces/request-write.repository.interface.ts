import { TimeOffRequestEntity } from '../entities/time-off-request.entity';

export interface IRequestWriteRepository {
  saveRequest(entity: TimeOffRequestEntity): Promise<TimeOffRequestEntity>;
}
