import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserService } from './services/user.service';
import { CreateUserInput, AssignRoleInput } from './dto';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentActor } from '../auth/decorators/current-actor.decorator';
import type { IActor } from '../shared/interfaces/actor.interface';
import { Role } from '../shared/types';
import { IsEmail, IsString, MinLength } from 'class-validator';

class LoginInput {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createUser(@Body() input: CreateUserInput) {
    return this.userService.createUser(input);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() input: LoginInput) {
    return this.userService.login(input.email, input.password);
  }

  @Post('roles')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  async assignRole(@Body() input: AssignRoleInput, @CurrentActor() actor: IActor) {
    input.assignedBy = actor.id;
    return this.userService.assignRole(input);
  }

  @Get(':id')
  @UseGuards(JwtGuard)
  async findById(@Param('id') id: string) {
    return this.userService.findById(id);
  }
}
