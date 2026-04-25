import { IsString, IsNumber, IsDateString, Min, IsOptional } from 'class-validator';

export class SubmitRequestInput {
  @IsString()
  employeeId: string;

  @IsString()
  locationId: string;

  @IsNumber()
  @Min(0.5)
  daysRequested: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsString()
  idempotencyKey: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
