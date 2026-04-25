import { BalanceEntity } from '../entities/balance.entity';

export interface IBalanceWriteRepository {
  upsertBalance(employeeId: string, locationId: string, hcmBalance: number, syncTimestamp: number): Promise<BalanceEntity>;
  updateBalanceWithVersion(entity: BalanceEntity): Promise<BalanceEntity>;
}
