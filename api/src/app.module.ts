import { Module } from '@nestjs/common';
import { DecksModule } from './decks/decks.module.js';
import { DumpsModule } from './dumps/dumps.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { workflowsEnabled } from './feature-flags.js';
import { WorkflowsModule } from './workflows/workflows.module.js';

const imports = [PrismaModule, DumpsModule, DecksModule];
if (workflowsEnabled()) {
  imports.push(WorkflowsModule);
}

@Module({
  imports,
})
export class AppModule {}
