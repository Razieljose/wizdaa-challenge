import { IsString, IsOptional } from 'class-validator';

export class RejectRequestInput {
  @IsString()
  requestId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
