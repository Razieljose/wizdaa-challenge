import { IBaseRepository } from '../../shared/base/base.repository.interface';
import { UserLocationRoleEntity } from '../entities/user-location-role.entity';
import { Role } from '../../shared/types';

export interface IUserRoleRepository extends IBaseRepository<UserLocationRoleEntity> {
  findByUserId(userId: string): Promise<UserLocationRoleEntity[]>;
  findByLocationIdAndRole(locationId: string, role: Role): Promise<UserLocationRoleEntity[]>;
}
