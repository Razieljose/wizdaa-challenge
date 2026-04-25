import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HcmBalanceWebhookDto } from './dto/hcm-webhook.dto';
import { BalanceService } from '../balance/services/balance.service';

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly balanceService: BalanceService,
    private readonly configService: ConfigService,
  ) {
    this.webhookSecret = this.configService.get<string>('WEBHOOK_SECRET', '');
  }

  @Post('hcm/balance')
  @HttpCode(HttpStatus.OK)
  async handleHcmBalanceUpdate(
    @Body() dto: HcmBalanceWebhookDto,
    @Headers('x-webhook-secret') secret: string,
  ) {
    if (this.webhookSecret && secret !== this.webhookSecret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    this.logger.log(
      `HCM webhook: balance update for ${dto.employeeId}/${dto.locationId} = ${dto.balance}`,
    );

    await this.balanceService.updateHcmBalance(
      dto.employeeId,
      dto.locationId,
      dto.balance,
      dto.generatedAtTimestamp,
    );

    return { received: true };
  }
}
