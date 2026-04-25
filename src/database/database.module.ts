import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserEntity } from '../user/entities/user.entity';
import { UserLocationRoleEntity } from '../user/entities/user-location-role.entity';
import { BalanceEntity } from '../balance/entities/balance.entity';
import { TimeOffRequestEntity } from '../request/entities/time-off-request.entity';
import { RequestAuditEntity } from '../request/entities/request-audit.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'better-sqlite3',
        database: configService.get<string>('DB_PATH', './data/timeoff.db'),
        entities: [
          UserEntity,
          UserLocationRoleEntity,
          BalanceEntity,
          TimeOffRequestEntity,
          RequestAuditEntity,
        ],
        synchronize: configService.get<string>('NODE_ENV', 'development') !== 'production',
        logging: configService.get<string>('DB_LOGGING', 'false') === 'true',
        extra: {
          // WAL mode for concurrent reads + busy_timeout for lock contention
          pragma: 'PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;',
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
