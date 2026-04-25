import { IsString, IsOptional, IsEnum } from 'class-validator';
import { RequestStatus } from '../../shared/types';

export class RequestsFilterInput {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @IsOptional()
  @IsString()
  startDateFrom?: string;

  @IsOptional()
  @IsString()
  startDateTo?: string;
}
