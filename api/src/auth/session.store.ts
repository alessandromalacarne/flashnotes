import {
  Injectable,
  InternalServerErrorException,
  Inject,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import type { RedisClientType } from '@redis/client';

import {
  type SessionRecord,
  SessionStore,
  AuthenticationStorage,
} from '@nestjs/authentication';

@Injectable()
export class RedisSessionStore implements SessionStore {
  private readonly logger = new Logger(RedisSessionStore.name);

  constructor(
    @Inject('REDIS_CLIENT') private client: RedisClientType,
    authenticationStorage: AuthenticationStorage,
  ) {
    authenticationStorage.registerSource({ sessions: this });
  }

  async createSession(record: SessionRecord): Promise<void> {
    const recordRepo = {
      userId: record.userId,
      createdAt: JSON.stringify(record.createdAt),
      expiresAt: JSON.stringify(record.expiresAt),
      lastActiveAt: JSON.stringify(record.lastActiveAt),
    };

    try {
      await this.client.hSet(`session:${record.id}`, recordRepo);
      await this.client.sAdd(`user:${record.userId}:sessions`, record.id);
      await this.client.expireAt(`session:${record.id}`, record.expiresAt);
    } catch (err) {
      this.logger.error('createSession failed', err);
      throw new InternalServerErrorException('Session creation failed');
    }
  }

  async getSession(id: string): Promise<SessionRecord | undefined> {
    let sessionValue: Record<string, string>;
    try {
      sessionValue = await this.client.hGetAll(`session:${id}`);
    } catch (err) {
      this.logger.error('getSession failed', err);
      throw new ServiceUnavailableException('Session store unavailable');
    }

    if (!sessionValue || Object.keys(sessionValue).length === 0) {
      return undefined;
    }

    return {
      id,
      userId: sessionValue.userId,
      createdAt: new Date(JSON.parse(sessionValue.createdAt)),
      expiresAt: new Date(JSON.parse(sessionValue.expiresAt)),
      lastActiveAt: new Date(JSON.parse(sessionValue.lastActiveAt)),
    };
  }

  async touchSession(id: string, lastActiveAt: Date): Promise<void> {
    try {
      await this.client.hSet(`session:${id}`, {
        lastActiveAt: JSON.stringify(lastActiveAt),
      });
    } catch (err) {
      this.logger.error('touchSession failed', err);
      throw new InternalServerErrorException('Session touch failed');
    }
  }

  async deleteSession(id: string): Promise<boolean> {
    try {
      const session = await this.getSession(id);
      const removed = await this.client.del(`session:${id}`);
      if (session) {
        await this.client.sRem(`user:${session.userId}:sessions`, id);
      }
      return removed > 0;
    } catch (err) {
      this.logger.error('deleteSession failed', err);
      throw new InternalServerErrorException('Session deletion failed');
    }
  }

  async listUserSessions(userId: string): Promise<SessionRecord[]> {
    try {
      const ids = await this.client.sMembers(`user:${userId}:sessions`);
      const sessions: SessionRecord[] = [];
      for (const id of ids) {
        const session = await this.getSession(id);
        if (session) sessions.push(session);
      }
      return sessions;
    } catch (err) {
      this.logger.error('listUserSessions failed', err);
      throw new ServiceUnavailableException('Session store unavailable');
    }
  }

  async deleteUserSessions(userId: string): Promise<void> {
    try {
      const ids = await this.client.sMembers(`user:${userId}:sessions`);
      for (const id of ids) {
        await this.client.del(`session:${id}`);
      }
      await this.client.del(`user:${userId}:sessions`);
    } catch (err) {
      this.logger.error('deleteUserSessions failed', err);
      throw new InternalServerErrorException('Session deletion failed');
    }
  }
}
