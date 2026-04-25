import {
  Entity,
  PrimaryColumn,
  Column,
  VersionColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { UuidUtil } from '../../shared/utils/uuid.util';
import { DateUtil } from '../../shared/utils/date.util';

@Entity('employee_balances')
@Index(['employeeId', 'locationId'], { unique: true })
export class BalanceEntity {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column('varchar', { length: 36 })
  employeeId: string;

  @Column('varchar')
  locationId: string;

  @Column('decimal', { default: 0 })
  hcmBalance: number;

  @Column('varchar', { nullable: true })
  lastSyncedAt: string;

  @Column('integer', { nullable: true })
  lastSyncedAtTimestamp: number;

  @VersionColumn()
  version: number;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = UuidUtil.generate();
    }
  }
}
