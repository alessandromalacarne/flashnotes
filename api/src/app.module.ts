import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthenticationModule } from '@nestjs/authentication';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { GroupsModule } from './groups/groups.module.js';
import { NotesModule } from './notes/notes.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { THROTTLE_LIMIT, THROTTLE_TTL_MS } from './security/throttle.config.js';
import { serverDbEnabled } from './feature-flags.js';

const databaseModules = serverDbEnabled() ? [NotesModule, GroupsModule] : [];

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'default', ttl: THROTTLE_TTL_MS, limit: THROTTLE_LIMIT },
    ]),
    AuthenticationModule.forRoot({
      session: {
        absoluteTtl: '14d',
        idleTtl: '3d',
        cookie: { secure: process.env.NODE_ENV === 'production' },
      },
    }),
    PrismaModule,
    AuthModule,
    ...databaseModules,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
