import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceEntity } from './entities/balance.entity';
import { BalanceReadRepository } from './repositories/balance.read.repository';
import { BalanceWriteRepository } from './repositories/balance.write.repository';
import { BalanceService } from './services/balance.service';
import { BalanceController } from './balance.controller';
import { AuthModule } from '../auth/auth.module';
import { RequestModule } from '../request/request.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BalanceEntity]),
    AuthModule,
    forwardRef(() => RequestModule),
  ],
  controllers: [BalanceController],
  providers: [BalanceReadRepository, BalanceWriteRepository, BalanceService],
  exports: [BalanceService, BalanceReadRepository, BalanceWriteRepository],
})
export class BalanceModule {}
