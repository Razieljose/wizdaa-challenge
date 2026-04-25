import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { HcmClient } from './hcm.client';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
    ConfigModule,
  ],
  providers: [HcmClient],
  exports: [HcmClient],
})
export class HcmModule {}
