import { IsString } from 'class-validator';

export class BalanceQueryInput {
  @IsString()
  employeeId: string;

  @IsString()
  locationId: string;
}
