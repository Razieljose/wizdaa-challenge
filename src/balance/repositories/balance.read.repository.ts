import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../shared/base/base.repository';
import { IBalanceReadRepository } from '../interfaces/balance-read.repository.interface';
import { BalanceEntity } from '../entities/balance.entity';

@Injectable()
export class BalanceReadRepository extends BaseRepository<BalanceEntity> implements IBalanceReadRepository {
  constructor(
    @InjectRepository(BalanceEntity)
    repository: Repository<BalanceEntity>,
  ) {
    super(repository);
  }

  async findByEmployeeAndLocation(employeeId: string, locationId: string): Promise<BalanceEntity | null> {
    return this.repository.findOne({ where: { employeeId, locationId } });
  }

  async findByEmployeeId(employeeId: string): Promise<BalanceEntity[]> {
    return this.repository.find({ where: { employeeId } });
  }
}
