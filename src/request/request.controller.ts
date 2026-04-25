import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RequestService } from './services/request.service';
import { SubmitRequestInput, RejectRequestInput } from './dto';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { LocationAccessGuard } from '../auth/guards/location-access.guard';
import { RequestLocationGuard } from './guards/request-location.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentActor } from '../auth/decorators/current-actor.decorator';
import { Role } from '../shared/types';
import { IActor } from '../shared/interfaces';

@Controller('requests')
@UseGuards(JwtGuard)
export class RequestController {
  constructor(private readonly requestService: RequestService) {}

  @Post()
  @Roles(Role.EMPLOYEE, Role.MANAGER)
  @UseGuards(RolesGuard, LocationAccessGuard)
  @HttpCode(HttpStatus.CREATED)
  async submit(@Body() input: SubmitRequestInput, @CurrentActor() actor: IActor) {
    return this.requestService.submit(input, actor);
  }

  @Patch(':id/approve')
  @Roles(Role.MANAGER)
  @UseGuards(RolesGuard, RequestLocationGuard)
  @HttpCode(HttpStatus.OK)
  async approve(@Param('id') id: string, @CurrentActor() actor: IActor) {
    return this.requestService.approve(id, actor);
  }

  @Patch(':id/reject')
  @Roles(Role.MANAGER)
  @UseGuards(RolesGuard, RequestLocationGuard)
  @HttpCode(HttpStatus.OK)
  async reject(
    @Param('id') id: string,
    @Body() input: RejectRequestInput,
    @CurrentActor() actor: IActor,
  ) {
    return this.requestService.reject(id, input.reason || 'Rejected by manager', actor);
  }

  @Patch(':id/cancel')
  @UseGuards(RequestLocationGuard)
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id') id: string, @CurrentActor() actor: IActor) {
    return this.requestService.cancel(id, actor);
  }

  @Get(':id')
  @UseGuards(RequestLocationGuard)
  @HttpCode(HttpStatus.OK)
  async findById(@Param('id') id: string) {
    return this.requestService.findById(id);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findByEmployee(
    @Query('employeeId') employeeId: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.requestService.findByEmployee(employeeId, locationId);
  }
}
