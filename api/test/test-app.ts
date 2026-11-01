import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { configureApp } from '../src/setup.js';

export const TEST_PASSWORD = 'correct horse battery';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
}

export type TestAgent = ReturnType<typeof request.agent>;

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  return { app, prisma: app.get(PrismaService) };
}

export async function signedInAgent(
  app: INestApplication,
  email = 'tester@example.com',
): Promise<TestAgent> {
  const agent = request.agent(app.getHttpServer());
  await agent
    .post('/auth/sign-up')
    .send({ email, password: TEST_PASSWORD })
    .expect(201);
  return agent;
}

export async function truncateAll(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Note", "Group", "User" CASCADE',
  );
}
