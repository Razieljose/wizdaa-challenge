import { IBaseRepository } from '../../shared/base/base.repository.interface';
import { BalanceEntity } from '../entities/balance.entity';

export interface IBalanceReadRepository extends IBaseRepository<BalanceEntity> {
  findByEmployeeAndLocation(employeeId: string, locationId: string): Promise<BalanceEntity | null>;
  findByEmployeeId(employeeId: string): Promise<BalanceEntity[]>;
}
