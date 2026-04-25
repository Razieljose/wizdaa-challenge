import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { IBalanceService } from '../interfaces/balance.service.interface';
import { BalanceReadRepository } from '../repositories/balance.read.repository';
import { BalanceWriteRepository } from '../repositories/balance.write.repository';
import { EffectiveBalanceOutput } from '../dto';
import { NotFoundError, OptimisticLockError } from '../../shared/exceptions';
import { TimeOffRequestEntity } from '../../request/entities/time-off-request.entity';
import { RequestStatus } from '../../shared/types';
import { DateUtil } from '../../shared/utils/date.util';

@Injectable()
export class BalanceService implements IBalanceService {
  private readonly logger = new Logger(BalanceService.name);

  constructor(
    private readonly balanceReadRepo: BalanceReadRepository,
    private readonly balanceWriteRepo: BalanceWriteRepository,
    @InjectRepository(TimeOffRequestEntity)
    private readonly requestRepo: Repository<TimeOffRequestEntity>,
  ) {}

  /**
   * Calculates effective balance:
   * effectiveBalance = hcmBalance - SUM(daysRequested) for PENDING, APPROVED, IN_SYNC requests
   */
  async getEffectiveBalance(employeeId: string, locationId: string): Promise<EffectiveBalanceOutput> {
    const balance = await this.balanceReadRepo.findByEmployeeAndLocation(employeeId, locationId);
    if (!balance) {
      throw new NotFoundError('Balance', `${employeeId}/${locationId}`);
    }

    const pendingDeductions = await this.calculatePendingDeductions(employeeId, locationId);

    const effectiveBalance = Number(balance.hcmBalance) - pendingDeductions;

    const output = new EffectiveBalanceOutput();
    output.employeeId = employeeId;
    output.locationId = locationId;
    output.hcmBalance = Number(balance.hcmBalance);
    output.pendingDeductions = pendingDeductions;
    output.effectiveBalance = effectiveBalance;
    output.lastSyncedAt = balance.lastSyncedAt;

    return output;
  }

  /**
   * Update HCM balance from sync with retry on optimistic lock conflict.
   */
  async updateHcmBalance(
    employeeId: string,
    locationId: string,
    hcmBalance: number,
    syncTimestamp: number,
  ): Promise<void> {
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this.balanceWriteRepo.upsertBalance(employeeId, locationId, hcmBalance, syncTimestamp);
        this.logger.log(`Updated HCM balance for ${employeeId}/${locationId}: ${hcmBalance}`);
        return;
      } catch (error) {
        if (error instanceof OptimisticLockError && attempt < maxRetries - 1) {
          this.logger.warn(`Optimistic lock retry ${attempt + 1} for ${employeeId}/${locationId}`);
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Calculate the sum of daysRequested for active (non-terminal) requests.
   */
  private async calculatePendingDeductions(employeeId: string, locationId: string): Promise<number> {
    const result = await this.requestRepo
      .createQueryBuilder('r')
      .select('COALESCE(SUM(r.daysRequested), 0)', 'total')
      .where('r.employeeId = :employeeId', { employeeId })
      .andWhere('r.locationId = :locationId', { locationId })
      .andWhere('r.status IN (:...statuses)', {
        statuses: [RequestStatus.PENDING, RequestStatus.APPROVED, RequestStatus.IN_SYNC],
      })
      .getRawOne();

    return parseFloat(result?.total || '0');
  }
}
