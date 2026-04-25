import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IBalanceWriteRepository } from '../interfaces/balance-write.repository.interface';
import { BalanceEntity } from '../entities/balance.entity';
import { OptimisticLockError } from '../../shared/exceptions';
import { UuidUtil } from '../../shared/utils/uuid.util';
import { DateUtil } from '../../shared/utils/date.util';

@Injectable()
export class BalanceWriteRepository implements IBalanceWriteRepository {
  private readonly logger = new Logger(BalanceWriteRepository.name);

  constructor(
    @InjectRepository(BalanceEntity)
    private readonly repository: Repository<BalanceEntity>,
  ) {}

  async upsertBalance(
    employeeId: string,
    locationId: string,
    hcmBalance: number,
    syncTimestamp: number,
  ): Promise<BalanceEntity> {
    let balance = await this.repository.findOne({ where: { employeeId, locationId } });

    if (balance) {
      balance.hcmBalance = hcmBalance;
      balance.lastSyncedAt = DateUtil.toISO(syncTimestamp);
      balance.lastSyncedAtTimestamp = syncTimestamp;
    } else {
      balance = new BalanceEntity();
      balance.id = UuidUtil.generate();
      balance.employeeId = employeeId;
      balance.locationId = locationId;
      balance.hcmBalance = hcmBalance;
      balance.lastSyncedAt = DateUtil.toISO(syncTimestamp);
      balance.lastSyncedAtTimestamp = syncTimestamp;
    }

    return this.repository.save(balance);
  }

  async updateBalanceWithVersion(entity: BalanceEntity): Promise<BalanceEntity> {
    try {
      return await this.repository.save(entity);
    } catch (error: any) {
      if (
        error?.name === 'OptimisticLockVersionMismatchError' ||
        error?.message?.includes('version')
      ) {
        this.logger.warn(`Optimistic lock conflict on balance ${entity.id}`);
        throw new OptimisticLockError('BalanceEntity', entity.id);
      }
      throw error;
    }
  }
}
