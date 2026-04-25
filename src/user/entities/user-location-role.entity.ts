import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { UuidUtil } from '../../shared/utils/uuid.util';
import { DateUtil } from '../../shared/utils/date.util';
import { UserEntity } from './user.entity';
import { Role } from '../../shared/types';

@Entity('user_location_roles')
@Index(['userId', 'locationId', 'role'], { unique: true })
@Index(['userId'])
@Index(['locationId', 'role'])
export class UserLocationRoleEntity {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column('varchar', { length: 36 })
  userId: string;

  @Column('varchar')
  locationId: string;

  @Column('varchar')
  role: Role;

  @Column('varchar', { nullable: true })
  createdAt: string;

  @Column('varchar', { nullable: true })
  updatedAt: string;

  @Column('varchar', { nullable: true })
  createdBy: string;

  @Column('varchar', { nullable: true })
  updatedBy: string;

  @ManyToOne(() => UserEntity, (user) => user.locationRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = UuidUtil.generate();
    }
    if (!this.createdAt) {
      this.createdAt = DateUtil.nowISO();
    }
    this.updatedAt = DateUtil.nowISO();
  }
}
