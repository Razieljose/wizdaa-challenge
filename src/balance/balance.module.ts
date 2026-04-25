import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceEntity } from './entities/balance.entity';
import { BalanceReadRepository } from './repositories/balance.read.repository';
import { BalanceWriteRepository } from './repositories/balance.write.repository';
import { BalanceService } from './services/balance.service';
import { BalanceController } from './balance.controller';
import { TimeOffRequestEntity } from '../request/entities/time-off-request.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BalanceEntity, TimeOffRequestEntity]),
    AuthModule,
  ],
  controllers: [BalanceController],
  providers: [BalanceReadRepository, BalanceWriteRepository, BalanceService],
  exports: [BalanceService, BalanceReadRepository, BalanceWriteRepository],
})
export class BalanceModule {}
