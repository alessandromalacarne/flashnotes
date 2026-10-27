import { Module } from '@nestjs/common';
import { workflowsEnabled } from '../feature-flags.js';
import { WorkflowsModule } from '../workflows/workflows.module.js';
import { DecksController } from './decks.controller.js';
import { DecksService } from './decks.service.js';

const imports = [];
if (workflowsEnabled()) {
  imports.push(WorkflowsModule);
}

@Module({
  imports,
  controllers: [DecksController],
  providers: [DecksService],
})
export class DecksModule {}
