/**
 * Contract: contracts/demo-account.feature
 *
 * API-side scenarios, in the same order as the feature file:
 *   - Entry through the API
 *   - The demo is not a credential account
 *   - Provisioning
 *   - Boundaries (except throttling, see demo-account-throttle.e2e-spec.ts)
 *
 * The web-side scenarios live in web/src/demo-account.test.tsx.
 */
import type { INestApplication } from '@nestjs/common';
import { createTestApp, truncateAll } from './test-app.js';
import {
  ACCOUNT,
  countDemoUsers,
  client,
  cookieAttributes,
  currentUser,
  DEMO_USER,
  enterDemo,
  percentile95,
  removeDemoUser,
  seedDemoUser,
  signIn,
  signUp,
  visitor,
  type DemoWorld,
} from './demo-account.steps.js';

let world: DemoWorld;

beforeAll(async () => {
  world = await createTestApp();
});

beforeEach(async () => {
  await truncateAll(world.prisma);
  await seedDemoUser(world);
});

afterAll(async () => {
  await world.app.close();
});

describe('Entry through the API', () => {
  it('entering the demo establishes a session for the demo user', async () => {
    const agent = visitor(world);

    const entered = await enterDemo(world, agent);
    expect(entered.status).toBe(200);
    expect(entered.body.user).toEqual(DEMO_USER);
    expect(cookieAttributes(entered.headers)).toContain('HttpOnly');

    const current = await currentUser(agent);
    expect(current.body).toEqual({ user: DEMO_USER });

    await agent.post('/auth/sign-out').expect(204);
    expect((await currentUser(agent)).body).toEqual({ user: null });
  });

  it('two anonymous visitors reach the same demo user', async () => {
    const first = await enterDemo(world);
    const second = await enterDemo(world);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.user.id).toBe(DEMO_USER.id);
    expect(second.body.user.id).toBe(DEMO_USER.id);
  });

  it('a request body cannot select a different identity', async () => {
    const entered = await visitor(world)
      .post('/auth/demo')
      .send({ email: ACCOUNT.email, password: ACCOUNT.password });

    expect(entered.status).toBe(200);
    expect(entered.body.user).toEqual(DEMO_USER);

    const attempt = await signIn(
      visitor(world),
      ACCOUNT.email,
      ACCOUNT.password,
    );
    expect(attempt.status).toBe(401);
  });

  it('a missing demo row is reported and creates nothing', async () => {
    await removeDemoUser(world);

    const entered = await enterDemo(world);

    expect(entered.status).toBe(503);
    expect(entered.body.message).toBe('Demo is not available');
    expect(entered.headers['set-cookie']).toBeUndefined();
    expect((await currentUser(visitor(world))).body).toEqual({ user: null });
    expect(await countDemoUsers(world)).toBe(0);
  });
});

describe('The demo is not a credential account', () => {
  it.each(['correct horse battery', 'demo', ''])(
    'password sign-in cannot open the demo with password %j',
    async (password) => {
      const agent = visitor(world);
      const attempt = await signIn(agent, DEMO_USER.email, password);

      expect(attempt.status).toBe(401);
      expect(attempt.body.message).toBe(
        'The demo account is available from the Try demo button',
      );
      expect(attempt.headers['set-cookie']).toBeUndefined();
      expect((await currentUser(agent)).body).toEqual({ user: null });
    },
  );

  it('sign-up cannot claim the demo address', async () => {
    const { response } = await signUp(world, DEMO_USER.email);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('Email already registered');
    expect(await countDemoUsers(world)).toBe(1);
  });
});

describe('The demo identity is not exposed', () => {
  it('the demo password hash is never exposed', async () => {
    const agent = visitor(world);
    const entered = await enterDemo(world, agent);
    const current = await currentUser(agent);

    expect(Object.keys(entered.body.user).sort()).toEqual([
      'email',
      'id',
      'isDemo',
    ]);
    expect(Object.keys(current.body.user).sort()).toEqual([
      'email',
      'id',
      'isDemo',
    ]);
    expect(JSON.stringify(current.body)).not.toContain(
      'unusable-demo-password-hash',
    );
  });

  it('real accounts report isDemo false', async () => {
    const { agent } = await signUp(world);
    const current = await currentUser(agent);

    expect(current.body.user).toEqual({
      id: expect.any(String),
      email: ACCOUNT.email,
      isDemo: false,
    });
  });

  it('failed demo sign-ins do not lock out other addresses', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await signIn(
        visitor(world),
        DEMO_USER.email,
        'wrong password',
      );
      expect(response.status).toBe(401);
    }

    const { agent } = await signUp(world);
    const signedIn = await signIn(agent, ACCOUNT.email, ACCOUNT.password);

    expect(signedIn.status).toBe(200);
    expect((await currentUser(agent)).body.user.email).toBe(ACCOUNT.email);
  });
});

describe('Provisioning', () => {
  it('the seed step is idempotent', async () => {
    await seedDemoUser(world);
    await seedDemoUser(world);

    const first = await enterDemo(world);
    const second = await enterDemo(world);

    expect(first.body.user.id).toBe(DEMO_USER.id);
    expect(second.body.user.id).toBe(DEMO_USER.id);
    expect(await countDemoUsers(world)).toBe(1);
  });

  it('seeding writes no notes or groups to the server', async () => {
    const agent = visitor(world);
    await enterDemo(world, agent).expect(200);

    expect((await agent.get('/notes')).body).toEqual([]);
    expect((await agent.get('/groups')).body).toEqual([]);
  });
});

describe('Boundaries', () => {
  it('only the auth routes are public', async () => {
    await client(world).get('/notes').expect(401);
    await client(world).get('/groups').expect(401);
  });

  it('a cross-origin demo request is rejected', async () => {
    const response = await client(world)
      .post('/auth/demo')
      .set('Origin', 'https://evil.example');

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('the demo session cookie matches a password sign-in cookie', async () => {
    const { agent: accountAgent } = await signUp(world);
    const signedIn = await signIn(
      accountAgent,
      ACCOUNT.email,
      ACCOUNT.password,
    );

    const entered = await enterDemo(world);

    expect(cookieAttributes(entered.headers)).toBe(
      cookieAttributes(signedIn.headers),
    );
    // NODE_ENV=test pins the cookie to plain HTTP; production adds Secure.
    expect(cookieAttributes(entered.headers)).toContain('HttpOnly');
    expect(cookieAttributes(entered.headers)).not.toContain('Secure');
  });

  it('demo entry responds without credential verification', async () => {
    const durations: number[] = [];

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const started = performance.now();
      const response = await enterDemo(world);
      durations.push(performance.now() - started);
      expect(response.status).toBe(200);
    }

    expect(percentile95(durations)).toBeLessThanOrEqual(200);
  });
});
