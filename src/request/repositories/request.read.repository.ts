import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { BaseRepository } from '../../shared/base/base.repository';
import { IRequestReadRepository } from '../interfaces/request-read.repository.interface';
import { TimeOffRequestEntity } from '../entities/time-off-request.entity';
import { RequestStatus } from '../../shared/types';

@Injectable()
export class RequestReadRepository extends BaseRepository<TimeOffRequestEntity> implements IRequestReadRepository {
  constructor(
    @InjectRepository(TimeOffRequestEntity)
    repository: Repository<TimeOffRequestEntity>,
  ) {
    super(repository);
  }

  async findByIdempotencyKey(key: string): Promise<TimeOffRequestEntity | null> {
    return this.repository.findOne({ where: { idempotencyKey: key } });
  }

  async findByEmployeeAndStatus(
    employeeId: string,
    statuses: RequestStatus[],
  ): Promise<TimeOffRequestEntity[]> {
    return this.repository.find({
      where: {
        employeeId,
        status: In(statuses),
      },
    });
  }

  async findOverlapping(
    employeeId: string,
    locationId: string,
    startDateTimestamp: number,
    endDateTimestamp: number,
    excludeStatuses: RequestStatus[],
  ): Promise<TimeOffRequestEntity[]> {
    const qb = this.repository.createQueryBuilder('r')
      .where('r.employeeId = :employeeId', { employeeId })
      .andWhere('r.locationId = :locationId', { locationId })
      .andWhere('r.startDateTimestamp <= :endTs', { endTs: endDateTimestamp })
      .andWhere('r.endDateTimestamp >= :startTs', { startTs: startDateTimestamp });

    if (excludeStatuses.length > 0) {
      qb.andWhere('r.status NOT IN (:...excludeStatuses)', { excludeStatuses });
    }

    return qb.getMany();
  }

  async findByStatusIn(statuses: RequestStatus[]): Promise<TimeOffRequestEntity[]> {
    return this.repository.find({
      where: {
        status: In(statuses),
      },
    });
  }

  async findPendingDeductionsAfterTimestamp(
    employeeId: string,
    locationId: string,
    afterTimestamp: number,
  ): Promise<TimeOffRequestEntity[]> {
    return this.repository.createQueryBuilder('r')
      .where('r.employeeId = :employeeId', { employeeId })
      .andWhere('r.locationId = :locationId', { locationId })
      .andWhere('r.status IN (:...statuses)', {
        statuses: [RequestStatus.PENDING, RequestStatus.APPROVED, RequestStatus.IN_SYNC],
      })
      .andWhere('r.createdAtTimestamp > :afterTimestamp', { afterTimestamp })
      .getMany();
  }
}
