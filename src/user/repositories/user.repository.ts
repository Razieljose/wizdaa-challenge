import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../shared/base/base.repository';
import { IUserRepository } from '../interfaces/user.repository.interface';
import { UserEntity } from '../entities/user.entity';

@Injectable()
export class UserRepository extends BaseRepository<UserEntity> implements IUserRepository {
  constructor(
    @InjectRepository(UserEntity)
    repository: Repository<UserEntity>,
  ) {
    super(repository);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.repository.findOne({ where: { email } });
  }
}
