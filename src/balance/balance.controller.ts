import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BalanceService } from './services/balance.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { LocationAccessGuard } from '../auth/guards/location-access.guard';
import { CurrentActor } from '../auth/decorators/current-actor.decorator';
import { IActor } from '../shared/interfaces';

@Controller('balances')
@UseGuards(JwtGuard, LocationAccessGuard)
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getEffectiveBalance(
    @Query('employeeId') employeeId: string,
    @Query('locationId') locationId: string,
    @CurrentActor() _actor: IActor,
  ) {
    return this.balanceService.getEffectiveBalance(employeeId, locationId);
  }
}
