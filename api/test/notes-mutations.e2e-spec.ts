import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
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

describe('rejecting an invalid update', () => {
  it('rejects an update without any deck and keeps the dump untouched', async () => {
    const created = await agent
      .post('/notes')
      .send({ content: 'buy coffee @home' })
      .expect(201);

    const response = await agent
      .patch(`/notes/${created.body.id}`)
      .send({ content: 'text without a deck' })
      .expect(400);

    expect(response.body.message).toBe(
      'Include at least one @group in the note',
    );

    const dumps = await agent.get('/notes').expect(200);

    expect(dumps.body).toMatchObject([
      { id: created.body.id, content: 'buy coffee' },
    ]);
  });

  it('rejects an update whose whole body is the marker', async () => {
    const created = await agent
      .post('/notes')
      .send({ content: 'buy coffee @home' })
      .expect(201);

    const response = await agent
      .patch(`/notes/${created.body.id}`)
      .send({ content: '@home' })
      .expect(400);

    expect(response.body.message).toBe(
      'The note needs text besides the @group',
    );

    const dumps = await agent.get('/notes').expect(200);

    expect(dumps.body).toMatchObject([
      { id: created.body.id, content: 'buy coffee' },
    ]);
  });

  it('rejects empty or blank content', async () => {
    const created = await agent
      .post('/notes')
      .send({ content: 'buy coffee @home' })
      .expect(201);

    await agent
      .patch(`/notes/${created.body.id}`)
      .send({ content: '' })
      .expect(400);

    await agent
      .patch(`/notes/${created.body.id}`)
      .send({ content: '   ' })
      .expect(400);
  });

  it('returns 404 for an unknown dump', async () => {
    const response = await agent
      .patch(`/notes/${randomUUID()}`)
      .send({ content: 'buy coffee @home' })
      .expect(404);

    expect(response.body.message).toBe('Note not found');
  });
});

describe('deleting a dump', () => {
  it('removes the dump from the lists', async () => {
    const created = await agent
      .post('/notes')
      .send({ content: 'buy coffee @home' })
      .expect(201);

    await agent.delete(`/notes/${created.body.id}`).expect(204);

    const all = await agent.get('/notes').expect(200);

    expect(all.body).toEqual([]);

    const byDeck = await agent.get('/notes?group=home').expect(200);

    expect(byDeck.body).toEqual([]);
  });

  it('returns 404 for an unknown dump', async () => {
    const response = await agent.delete(`/notes/${randomUUID()}`).expect(404);

    expect(response.body.message).toBe('Note not found');
  });

  it('keeps the decks other dumps still use and drops the empty ones', async () => {
    await agent
      .post('/notes')
      .send({ content: 'item one @home @work' })
      .expect(201);

    const removed = await agent
      .post('/notes')
      .send({ content: 'item two @leisure' })
      .expect(201);

    await agent.delete(`/notes/${removed.body.id}`).expect(204);

    const decks = await agent.get('/groups').expect(200);

    expect(decks.body).toEqual([
      { id: expect.any(String), name: 'home', count: 1 },
      { id: expect.any(String), name: 'work', count: 1 },
    ]);
  });
});
