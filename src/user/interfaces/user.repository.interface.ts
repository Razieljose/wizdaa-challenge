import { IBaseRepository } from '../../shared/base/base.repository.interface';
import { UserEntity } from '../entities/user.entity';

export interface IUserRepository extends IBaseRepository<UserEntity> {
  findByEmail(email: string): Promise<UserEntity | null>;
}
