import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  BeforeInsert,
} from 'typeorm';
import { UuidUtil } from '../../shared/utils/uuid.util';
import { DateUtil } from '../../shared/utils/date.util';
import { UserLocationRoleEntity } from './user-location-role.entity';

@Entity('users')
export class UserEntity {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column('varchar', { unique: true })
  email: string;

  @Column('varchar')
  name: string;

  @Column('varchar')
  passwordHash: string;

  @Column('boolean', { default: true })
  isActive: boolean;

  @Column('varchar', { nullable: true })
  createdAt: string;

  @Column('varchar', { nullable: true })
  updatedAt: string;

  @Column('varchar', { nullable: true })
  createdBy: string;

  @Column('varchar', { nullable: true })
  updatedBy: string;

  @OneToMany(() => UserLocationRoleEntity, (role) => role.user)
  locationRoles: UserLocationRoleEntity[];

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
