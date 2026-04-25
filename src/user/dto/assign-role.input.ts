import { IsString, IsEnum, IsOptional } from 'class-validator';
import { Role } from '../../shared/types';

export class AssignRoleInput {
  @IsString()
  userId: string;

  @IsString()
  locationId: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsString()
  assignedBy?: string;
}
