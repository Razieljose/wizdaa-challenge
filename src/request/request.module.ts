import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { TimeOffRequestEntity } from './entities/time-off-request.entity';
import { RequestAuditEntity } from './entities/request-audit.entity';
import { RequestReadRepository } from './repositories/request.read.repository';
import { RequestAuditRepository } from './repositories/request-audit.repository';
import { RequestStateMachine } from './services/request-state-machine';
import { RequestService } from './services/request.service';
import { RequestController } from './request.controller';
import { RequestLocationGuard } from './guards/request-location.guard';
import { BalanceModule } from '../balance/balance.module';
import { AuthModule } from '../auth/auth.module';
import { HcmModule } from '../hcm/hcm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TimeOffRequestEntity, RequestAuditEntity]),
    forwardRef(() => BalanceModule),
    AuthModule,
    ConfigModule,
    HcmModule,
  ],
  controllers: [RequestController],
  providers: [
    RequestReadRepository,
    RequestAuditRepository,
    RequestStateMachine,
    RequestService,
    RequestLocationGuard,
  ],
  exports: [RequestService, RequestReadRepository, RequestStateMachine, RequestLocationGuard],
})
export class RequestModule {}
