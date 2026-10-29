import { Module } from '@nestjs/common';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthModule } from './auth/auth.module.js';
import { DecksModule } from './decks/decks.module.js';
import { DumpsModule } from './dumps/dumps.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    AuthenticationModule.forRoot({
      session: {
        absoluteTtl: '14d',
        idleTtl: '3d',
        cookie: { secure: process.env.NODE_ENV === 'production' },
      },
    }),
    PrismaModule,
    AuthModule,
    DumpsModule,
    DecksModule,
  ],
})
export class AppModule {}
