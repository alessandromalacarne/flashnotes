/**
 * Contract: contracts/demo-account.feature
 * Scenario: Demo entry does not depend on the server notes routes
 *
 * The flag is read when the app module graph loads, so it is set before the
 * import and restored right after, like server-db-flag.e2e-spec.ts does.
 */
import {
  DEMO_USER,
  enterDemo,
  seedDemoUser,
  visitor,
  type DemoWorld,
} from './demo-account.steps.js';

const FLAG = 'FLASHNOTES_SERVER_DB';
const previous = process.env[FLAG];
process.env[FLAG] = 'off';

const { createTestApp, truncateAll } = await import('./test-app.js');

if (previous === undefined) {
  delete process.env[FLAG];
} else {
  process.env[FLAG] = previous;
}

let world: DemoWorld;

beforeAll(async () => {
  world = await createTestApp();
});

afterAll(async () => {
  await world.app.close();
});

it('entering the demo works while the notes routes are not mounted', async () => {
  await truncateAll(world.prisma);
  await seedDemoUser(world);

  const agent = visitor(world);
  const entered = await enterDemo(world, agent);

  expect(entered.status).toBe(200);
  expect(entered.body.user).toEqual(DEMO_USER);

  // The flag is really off: the routes this flow must not depend on are gone.
  await agent.get('/notes').expect(404);
  await agent.get('/groups').expect(404);

  const current = await agent.get('/auth/me');
  expect(current.body.user).toEqual(DEMO_USER);
});
