import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { UserEntity } from '../entities/user.entity';

@Injectable()
export class UserWriteRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repository: Repository<UserEntity>,
  ) {}

  async save(entity: UserEntity): Promise<UserEntity> {
    return this.repository.save(entity as DeepPartial<UserEntity>);
  }
}
