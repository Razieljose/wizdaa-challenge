import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './entities/user.entity';
import { UserLocationRoleEntity } from './entities/user-location-role.entity';
import { UserRepository } from './repositories/user.repository';
import { UserWriteRepository } from './repositories/user.write.repository';
import { UserRoleRepository } from './repositories/user-role.repository';
import { UserService } from './services/user.service';
import { UserController } from './user.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, UserLocationRoleEntity]),
    AuthModule,
  ],
  controllers: [UserController],
  providers: [UserRepository, UserWriteRepository, UserRoleRepository, UserService],
  exports: [UserService, UserRepository, UserWriteRepository, UserRoleRepository],
})
export class UserModule {}
