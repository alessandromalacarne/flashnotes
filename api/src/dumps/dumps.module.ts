import { Module } from '@nestjs/common';
import { DumpsController } from './dumps.controller.js';
import { DumpsService } from './dumps.service.js';
import { workflowsEnabled } from '../feature-flags.js';
import { WorkflowsModule } from '../workflows/workflows.module.js';

const imports = [];
if (workflowsEnabled()) {
  imports.push(WorkflowsModule);
}

@Module({
  imports,
  controllers: [DumpsController],
  providers: [DumpsService],
})
export class DumpsModule {}
