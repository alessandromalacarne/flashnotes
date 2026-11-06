import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, signedInAgent, truncateAll } from './test-app.js';

let app: INestApplication;
let prisma: PrismaService;
let agent: ReturnType<typeof request.agent>;

beforeAll(async () => {
  ({ app, prisma } = await createTestApp());
});

beforeEach(async () => {
  await truncateAll(prisma);
  agent = await signedInAgent(app);
});

afterAll(async () => {
  await app.close();
});

function groups(count: number): string {
  return Array.from({ length: count }, (_, index) => `@g${index}`).join(' ');
}

describe('note limits', () => {
  it('rejects content over 10,000 characters', async () => {
    await agent
      .post('/notes')
      .send({ content: `${'a'.repeat(10_001)} @home` })
      .expect(400);
  });

  it('accepts content of exactly 10,000 characters', async () => {
    await agent
      .post('/notes')
      .send({ content: `${'a'.repeat(10_000 - ' @home'.length)} @home` })
      .expect(201);
  });

  it('rejects more than 32 groups in one note', async () => {
    const response = await agent
      .post('/notes')
      .send({ content: `note ${groups(33)}` })
      .expect(400);

    expect(response.body.message).toBe(
      'A note can reference at most 32 groups',
    );
  });

  it('accepts exactly 32 groups in one note', async () => {
    await agent
      .post('/notes')
      .send({ content: `note ${groups(32)}` })
      .expect(201);
  });

  it('rejects a group name over 72 characters', async () => {
    const response = await agent
      .post('/notes')
      .send({ content: `note @${'a'.repeat(73)}` })
      .expect(400);

    expect(response.body.message).toBe(
      'Group names can have at most 72 characters',
    );
  });

  it('accepts a group name of exactly 72 characters', async () => {
    await agent
      .post('/notes')
      .send({ content: `note @${'a'.repeat(72)}` })
      .expect(201);
  });

  it('enforces the content limit on update too', async () => {
    const created = await agent
      .post('/notes')
      .send({ content: 'buy coffee @home' })
      .expect(201);

    await agent
      .patch(`/notes/${created.body.id}`)
      .send({ content: `${'a'.repeat(10_001)} @home` })
      .expect(400);
  });
});
