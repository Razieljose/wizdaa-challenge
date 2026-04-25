import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestAuditEntity } from '../entities/request-audit.entity';
import { UuidUtil } from '../../shared/utils/uuid.util';
import { DateUtil } from '../../shared/utils/date.util';

@Injectable()
export class RequestAuditRepository {
  constructor(
    @InjectRepository(RequestAuditEntity)
    private readonly repository: Repository<RequestAuditEntity>,
  ) {}

  buildEntity(
    requestId: string,
    actorId: string,
    previousStatus: string,
    newStatus: string,
    action: string,
    reason?: string,
  ): RequestAuditEntity {
    const audit = new RequestAuditEntity();
    audit.id = UuidUtil.generate();
    audit.requestId = requestId;
    audit.actorId = actorId;
    audit.previousStatus = previousStatus;
    audit.newStatus = newStatus;
    audit.action = action;
    audit.reason = reason || '';
    audit.createdAt = DateUtil.nowISO();
    audit.createdAtTimestamp = DateUtil.nowTimestamp();
    return audit;
  }

  async logTransition(
    requestId: string,
    actorId: string,
    previousStatus: string,
    newStatus: string,
    action: string,
    reason?: string,
  ): Promise<RequestAuditEntity> {
    return this.repository.save(
      this.buildEntity(requestId, actorId, previousStatus, newStatus, action, reason),
    );
  }

  async findByRequestId(requestId: string): Promise<RequestAuditEntity[]> {
    return this.repository.find({
      where: { requestId },
      order: { createdAtTimestamp: 'ASC' },
    });
  }
}
