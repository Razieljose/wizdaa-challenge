import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebhookController } from './webhook.controller';
import { BalanceModule } from '../balance/balance.module';

@Module({
  imports: [BalanceModule, ConfigModule],
  controllers: [WebhookController],
})
export class WebhookModule {}
