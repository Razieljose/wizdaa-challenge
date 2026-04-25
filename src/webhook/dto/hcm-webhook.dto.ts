import { IsString, IsNumber, IsNotEmpty } from 'class-validator';

export class HcmBalanceWebhookDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsString()
  @IsNotEmpty()
  locationId: string;

  @IsNumber()
  balance: number;

  @IsString()
  @IsNotEmpty()
  generatedAt: string;

  @IsNumber()
  generatedAtTimestamp: number;
}
