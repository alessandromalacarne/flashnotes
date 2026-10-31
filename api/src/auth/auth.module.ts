import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { CredentialsService } from './credentials.service.js';
import { RedisSessionStore } from './session.store.js';
import { SessionAuth } from './session-auth.provider.js';
import { createClient } from '@redis/client';

const providers: any[] = [SessionAuth, CredentialsService];

if (process.env.REDIS_URL) {
  providers.unshift({
    provide: 'REDIS_CLIENT',
    useFactory: async () => {
      const client = createClient({ url: process.env.REDIS_URL });
      await client.connect();
      return client;
    },
  });
  providers.push(RedisSessionStore);
}

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers,
})
export class AuthModule {}
