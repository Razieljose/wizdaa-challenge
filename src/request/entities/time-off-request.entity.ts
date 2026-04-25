import {
  Entity,
  PrimaryColumn,
  Column,
  Index,
  BeforeInsert,
} from 'typeorm';
import { UuidUtil } from '../../shared/utils/uuid.util';
import { DateUtil } from '../../shared/utils/date.util';
import { RequestStatus } from '../../shared/types';

@Entity('time_off_requests')
@Index(['idempotencyKey'], { unique: true })
@Index(['employeeId', 'status'])
@Index(['status'])
@Index(['employeeId', 'startDateTimestamp', 'endDateTimestamp'])
@Index(['manualReviewReason'])
export class TimeOffRequestEntity {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column('varchar', { length: 36 })
  employeeId: string;

  @Column('varchar')
  locationId: string;

  @Column('decimal')
  daysRequested: number;

  @Column('varchar')
  status: RequestStatus;

  @Column('varchar')
  startDate: string;

  @Column('integer')
  startDateTimestamp: number;

  @Column('varchar')
  endDate: string;

  @Column('integer')
  endDateTimestamp: number;

  @Column('varchar', { nullable: true })
  hcmReferenceId: string;

  @Column('varchar', { nullable: true })
  rejectionReason: string;

  @Column('varchar', { nullable: true })
  cancelledBy: string;

  @Column('varchar', { nullable: true })
  cancelledAt: string;

  @Column('varchar', { nullable: true })
  manualReviewReason: string | null;

  @Column('varchar')
  idempotencyKey: string;

  @Column('varchar', { nullable: true })
  createdAt: string;

  @Column('integer', { nullable: true })
  createdAtTimestamp: number;

  @Column('varchar', { nullable: true })
  updatedAt: string;

  @BeforeInsert()
  generateDefaults() {
    if (!this.id) {
      this.id = UuidUtil.generate();
    }
    if (!this.createdAt) {
      this.createdAt = DateUtil.nowISO();
      this.createdAtTimestamp = DateUtil.nowTimestamp();
    }
    this.updatedAt = DateUtil.nowISO();
    if (!this.status) {
      this.status = RequestStatus.PENDING;
    }
    if (this.startDate && !this.startDateTimestamp) {
      this.startDateTimestamp = DateUtil.toTimestamp(this.startDate);
    }
    if (this.endDate && !this.endDateTimestamp) {
      this.endDateTimestamp = DateUtil.toTimestamp(this.endDate);
    }
  }
}
