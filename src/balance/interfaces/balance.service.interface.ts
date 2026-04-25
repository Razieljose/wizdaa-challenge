import { EffectiveBalanceOutput } from '../dto';

export interface IBalanceService {
  getEffectiveBalance(employeeId: string, locationId: string): Promise<EffectiveBalanceOutput>;
  updateHcmBalance(employeeId: string, locationId: string, hcmBalance: number, syncTimestamp: number): Promise<void>;
}
