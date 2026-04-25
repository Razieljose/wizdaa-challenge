import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IRequestWriteRepository } from '../interfaces/request-write.repository.interface';
import { TimeOffRequestEntity } from '../entities/time-off-request.entity';
import { DateUtil } from '../../shared/utils/date.util';

@Injectable()
export class RequestWriteRepository implements IRequestWriteRepository {
  constructor(
    @InjectRepository(TimeOffRequestEntity)
    private readonly repository: Repository<TimeOffRequestEntity>,
  ) {}

  async saveRequest(entity: TimeOffRequestEntity): Promise<TimeOffRequestEntity> {
    entity.updatedAt = DateUtil.nowISO();
    return this.repository.save(entity);
  }
}
