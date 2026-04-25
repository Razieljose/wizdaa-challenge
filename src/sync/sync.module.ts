import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncCron } from './sync.cron';
import { HcmModule } from '../hcm/hcm.module';
import { RequestModule } from '../request/request.module';
import { BalanceModule } from '../balance/balance.module';

@Module({
  imports: [HcmModule, RequestModule, BalanceModule],
  providers: [SyncService, SyncCron],
  exports: [SyncService],
})
export class SyncModule {}
