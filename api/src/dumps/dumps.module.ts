import { Module } from '@nestjs/common';
import { DumpsController } from './dumps.controller.js';
import { DumpsService } from './dumps.service.js';

@Module({
  controllers: [DumpsController],
  providers: [DumpsService],
})
export class DumpsModule {}
