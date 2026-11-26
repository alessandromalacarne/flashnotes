/**
 * Contract: contracts/demo-account.feature
 * Scenario: The demo route is throttled per client
 *
 * The feature states the production budget (20 per 60 s); this test lowers it
 * to 3 so the boundary is cheap to prove. The limits are read when the app
 * module graph loads, so they are set before the import and restored after.
 */
import {
  DEMO_USER,
  enterDemo,
  seedDemoUser,
  visitor,
  type DemoWorld,
} from './demo-account.steps.js';

function restore(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

const previousLimit = process.env.DEMO_THROTTLE_LIMIT;
const previousTtl = process.env.DEMO_THROTTLE_TTL_MS;
process.env.DEMO_THROTTLE_LIMIT = '3';
process.env.DEMO_THROTTLE_TTL_MS = '60000';

const { createTestApp, truncateAll } = await import('./test-app.js');

restore('DEMO_THROTTLE_LIMIT', previousLimit);
restore('DEMO_THROTTLE_TTL_MS', previousTtl);

let world: DemoWorld;

beforeAll(async () => {
  world = await createTestApp();
  await truncateAll(world.prisma);
  await seedDemoUser(world);
});

afterAll(async () => {
  await world.app.close();
});

it('answers 429 with no session once the demo budget is spent', async () => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const allowed = await enterDemo(world);
    expect(allowed.status).toBe(200);
    expect(allowed.body.user).toEqual(DEMO_USER);
  }

  const blocked = await enterDemo(world, visitor(world));

  expect(blocked.status).toBe(429);
  expect(blocked.headers['set-cookie']).toBeUndefined();
});
