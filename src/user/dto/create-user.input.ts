import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class CreateUserInput {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  createdBy?: string;
}
