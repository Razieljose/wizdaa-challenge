import {
  Entity,
  PrimaryColumn,
  Column,
  Index,
  BeforeInsert,
} from 'typeorm';
import { UuidUtil } from '../../shared/utils/uuid.util';
import { DateUtil } from '../../shared/utils/date.util';

/**
 * Audit log for every state transition on a time-off request.
 * Immutable: rows are insert-only.
 */
@Entity('request_audit_log')
@Index(['requestId'])
@Index(['actorId'])
export class RequestAuditEntity {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column('varchar', { length: 36 })
  requestId: string;

  @Column('varchar', { length: 36 })
  actorId: string;

  @Column('varchar')
  previousStatus: string;

  @Column('varchar')
  newStatus: string;

  @Column('varchar', { nullable: true })
  action: string;

  @Column('varchar', { nullable: true })
  reason: string;

  @Column('varchar')
  createdAt: string;

  @Column('integer')
  createdAtTimestamp: number;

  @BeforeInsert()
  generateDefaults() {
    if (!this.id) {
      this.id = UuidUtil.generate();
    }
    if (!this.createdAt) {
      this.createdAt = DateUtil.nowISO();
      this.createdAtTimestamp = DateUtil.nowTimestamp();
    }
  }
}
