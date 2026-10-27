import { Module } from '@nestjs/common';
import { DecksModule } from './decks/decks.module.js';
import { DumpsModule } from './dumps/dumps.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, DumpsModule, DecksModule],
})
export class AppModule {}
