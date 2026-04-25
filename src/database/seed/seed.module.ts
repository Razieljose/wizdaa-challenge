import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SeedService } from './seed.service';

@Module({
  imports: [ConfigModule],
  providers: [SeedService],
})
export class SeedModule {}
