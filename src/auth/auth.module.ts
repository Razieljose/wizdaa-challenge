import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtGuard } from './guards/jwt.guard';
import { RolesGuard } from './guards/roles.guard';
import { LocationAccessGuard } from './guards/location-access.guard';
import { UserEntity } from '../user/entities/user.entity';
import { UserLocationRoleEntity } from '../user/entities/user-location-role.entity';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'default-secret-change-me'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '8h') as any,
        },
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([UserEntity, UserLocationRoleEntity]),
    ConfigModule,
  ],
  providers: [JwtStrategy, JwtGuard, RolesGuard, LocationAccessGuard],
  exports: [JwtModule, PassportModule, JwtGuard, RolesGuard, LocationAccessGuard],
})
export class AuthModule {}
