import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../shared/base/base.repository';
import { IUserRoleRepository } from '../interfaces/user-role.repository.interface';
import { UserLocationRoleEntity } from '../entities/user-location-role.entity';
import { Role } from '../../shared/types';

@Injectable()
export class UserRoleRepository extends BaseRepository<UserLocationRoleEntity> implements IUserRoleRepository {
  constructor(
    @InjectRepository(UserLocationRoleEntity)
    repository: Repository<UserLocationRoleEntity>,
  ) {
    super(repository);
  }

  async findByUserId(userId: string): Promise<UserLocationRoleEntity[]> {
    return this.repository.find({ where: { userId } });
  }

  async findByLocationIdAndRole(locationId: string, role: Role): Promise<UserLocationRoleEntity[]> {
    return this.repository.find({ where: { locationId, role } });
  }
}
