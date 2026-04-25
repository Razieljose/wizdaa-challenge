import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { SharedModule } from './shared/shared.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { BalanceModule } from './balance/balance.module';
import { RequestModule } from './request/request.module';
import { HcmModule } from './hcm/hcm.module';
import { SyncModule } from './sync/sync.module';
import { WebhookModule } from './webhook/webhook.module';
import { SeedModule } from './database/seed/seed.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    ScheduleModule.forRoot(),
    SharedModule,
    DatabaseModule,
    AuthModule,
    UserModule,
    BalanceModule,
    RequestModule,
    HcmModule,
    SyncModule,
    WebhookModule,
    SeedModule,
  ],
})
export class AppModule {}
