import { describe, it, expect, beforeEach } from 'vitest';
import { RedisSessionStore } from './session.store.js';

// Minimal in-memory fake of the subset of the Redis client we use.
function createFakeClient() {
  const hashes = new Map<string, Record<string, string>>();
  const sets = new Map<string, Set<string>>();
  const strings = new Map<string, string>();

  return {
    hSet: async (
      key: string,
      value: Record<string, string> | { [k: string]: string },
    ) => {
      const existing = hashes.get(key) ?? {};
      hashes.set(key, { ...existing, ...(value as Record<string, string>) });
      return 1;
    },
    hGetAll: async (key: string) => hashes.get(key) ?? {},
    sAdd: async (key: string, member: string) => {
      if (!sets.has(key)) sets.set(key, new Set());
      sets.get(key)!.add(member);
      return 1;
    },
    sMembers: async (key: string) => [...(sets.get(key) ?? new Set())],
    sRem: async (key: string, member: string) => {
      sets.get(key)?.delete(member);
      return 1;
    },
    del: async (key: string) => {
      const existed =
        hashes.delete(key) || sets.delete(key) || strings.delete(key);
      return existed ? 1 : 0;
    },
    expireAt: async () => 1,
    _hashes: hashes,
    _sets: sets,
  };
}

describe('RedisSessionStore', () => {
  let client: ReturnType<typeof createFakeClient>;
  let store: RedisSessionStore;

  beforeEach(() => {
    client = createFakeClient();
    const storage = { registerSource: () => {} } as any;
    store = new RedisSessionStore(client as any, storage);
  });

  it('lists a session after it is created', async () => {
    const record = {
      id: 'sess-1',
      userId: 'user-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      expiresAt: new Date('2026-01-02T00:00:00.000Z'),
      lastActiveAt: new Date('2026-01-01T00:00:00.000Z'),
    } as any;

    await store.createSession(record);

    const sessions = await store.listUserSessions('user-1');
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('sess-1');
    expect(sessions[0].userId).toBe('user-1');
  });

  it('removes the session from the index when deleted', async () => {
    const record = {
      id: 'sess-1',
      userId: 'user-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      expiresAt: new Date('2026-01-02T00:00:00.000Z'),
      lastActiveAt: new Date('2026-01-01T00:00:00.000Z'),
    } as any;

    await store.createSession(record);
    await store.deleteSession('sess-1');

    const sessions = await store.listUserSessions('user-1');
    expect(sessions).toHaveLength(0);
  });

  it('deletes all sessions of a user', async () => {
    const r1 = {
      id: 's1',
      userId: 'u1',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
      lastActiveAt: new Date(),
    } as any;
    const r2 = {
      id: 's2',
      userId: 'u1',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
      lastActiveAt: new Date(),
    } as any;

    await store.createSession(r1);
    await store.createSession(r2);
    await store.deleteUserSessions('u1');

    expect(await store.listUserSessions('u1')).toHaveLength(0);
    expect(await store.getSession('s1')).toBeUndefined();
    expect(await store.getSession('s2')).toBeUndefined();
  });
});
