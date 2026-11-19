import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service.js';

process.env.THROTTLE_LIMIT ??= '10000';
process.env.AUTH_THROTTLE_LIMIT ??= '10000';

const FLAG = 'FLASHNOTES_SERVER_DB';
const TEST_EMAIL = 'tester@example.com';
const TEST_PASSWORD = 'correct horse battery';

async function importApp() {
  const [{ AppModule }, { configureApp }, testing, prismaModule] =
    await Promise.all([
      import('../src/app.module.js'),
      import('../src/setup.js'),
      import('@nestjs/testing'),
      import('../src/prisma/prisma.service.js'),
    ]);
  return { AppModule, configureApp, testing, prismaModule };
}

async function createApp(
  flag: string | undefined,
): Promise<{ app: INestApplication; prisma: PrismaService }> {
  vi.resetModules();
  const previous = process.env[FLAG];
  if (flag === undefined) {
    delete process.env[FLAG];
  } else {
    process.env[FLAG] = flag;
  }
  try {
    const { AppModule, configureApp, testing, prismaModule } =
      await importApp();
    const moduleRef = await testing.Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    return { app, prisma: app.get(prismaModule.PrismaService) };
  } finally {
    if (previous === undefined) {
      delete process.env[FLAG];
    } else {
      process.env[FLAG] = previous;
    }
  }
}

async function signedUpAgent(
  app: INestApplication,
  prisma: PrismaService,
): Promise<ReturnType<typeof request.agent>> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Note", "Group", "User" CASCADE',
  );
  const agent = request.agent(app.getHttpServer());
  await agent
    .post('/auth/sign-up')
    .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
    .expect(201);
  return agent;
}

describe('server database feature flag', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  afterEach(async () => {
    await app?.close();
  });

  it.each([
    ['unset', undefined],
    ['on', 'on'],
  ])(
    'serves the notes and groups routes when FLASHNOTES_SERVER_DB is %s',
    async (_label, flag) => {
      ({ app, prisma } = await createApp(flag));
      const agent = await signedUpAgent(app, prisma);

      const created = await agent
        .post('/notes')
        .send({ content: 'buy coffee @home' })
        .expect(201);
      expect(created.body).toMatchObject({ content: 'buy coffee' });

      await agent.get('/notes').expect(200);
      await agent.get('/groups').expect(200);
    },
  );

  it.each([['off'], ['false'], ['0'], ['no']])(
    'returns 404 for the notes and groups routes when FLASHNOTES_SERVER_DB is %s',
    async (flag) => {
      ({ app, prisma } = await createApp(flag));
      const agent = await signedUpAgent(app, prisma);

      await agent
        .post('/notes')
        .send({ content: 'buy coffee @home' })
        .expect(404);
      await agent.get('/notes').expect(404);
      await agent
        .patch('/notes/some-id')
        .send({ content: 'buy tea @work' })
        .expect(404);
      await agent.delete('/notes/some-id').expect(404);
      await agent.get('/groups').expect(404);
      await agent.delete('/groups/some-id').expect(404);
    },
  );

  it('keeps the auth routes when the flag is off', async () => {
    ({ app, prisma } = await createApp('off'));
    const agent = await signedUpAgent(app, prisma);

    await agent.get('/auth/me').expect(200);
    await agent.post('/auth/sign-out').expect(204);
  });
});
