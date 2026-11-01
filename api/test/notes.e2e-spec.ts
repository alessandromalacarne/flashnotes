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

describe('creating a dump', () => {
  it('stores the body without the deck marker and links the deck', async () => {
    const response = await agent
      .post('/notes')
      .send({ content: 'buy coffee @home' })
      .expect(201);

    expect(response.body).toMatchObject({
      content: 'buy coffee',
      groups: [{ name: 'home' }],
    });
    expect(response.body.id).toEqual(expect.any(String));
    expect(response.body.createdAt).toEqual(expect.any(String));
  });

  it('reuses the existing deck instead of duplicating it', async () => {
    const first = await agent
      .post('/notes')
      .send({ content: 'buy coffee @Home' })
      .expect(201);

    const second = await agent
      .post('/notes')
      .send({ content: 'clean kitchen @home' })
      .expect(201);

    expect(first.body.groups).toEqual([
      { id: expect.any(String), name: 'home' },
    ]);
    expect(second.body.groups).toEqual([
      { id: first.body.groups[0].id, name: 'home' },
    ]);
  });
});

describe('rejecting an invalid dump', () => {
  it('rejects a dump without any deck', async () => {
    const response = await agent
      .post('/notes')
      .send({ content: 'text without a deck' })
      .expect(400);

    expect(response.body.message).toBe(
      'Include at least one @group in the note',
    );
  });

  it('rejects a marker that is not at the end', async () => {
    for (const content of ['@home buy coffee', 'buy coffee @home now']) {
      const response = await agent.post('/notes').send({ content }).expect(400);

      expect(response.body.message).toBe(
        'Include at least one @group in the note',
      );
    }
  });

  it('rejects a dump whose whole body is the marker', async () => {
    const response = await agent
      .post('/notes')
      .send({ content: '  @home @work  ' })
      .expect(400);

    expect(response.body.message).toBe(
      'The note needs text besides the @group',
    );
  });

  it('rejects empty or blank content', async () => {
    await agent.post('/notes').send({ content: '' }).expect(400);

    await agent.post('/notes').send({ content: '   ' }).expect(400);
  });
});

describe('listing dumps', () => {
  it('lists dumps newest first', async () => {
    await agent.post('/notes').send({ content: 'first @home' }).expect(201);

    await agent.post('/notes').send({ content: 'second @home' }).expect(201);

    const response = await agent.get('/notes').expect(200);

    expect(
      response.body.map((note: { content: string }) => note.content),
    ).toEqual(['second', 'first']);
    expect(response.body[0].groups).toEqual([
      { id: expect.any(String), name: 'home' },
    ]);
  });

  it('filters dumps by deck, ignoring case', async () => {
    await agent.post('/notes').send({ content: 'home item @home' }).expect(201);
    await agent.post('/notes').send({ content: 'work item @work' }).expect(201);
    await agent
      .post('/notes')
      .send({ content: 'another item @Home' })
      .expect(201);

    const response = await agent.get('/notes?group=Home').expect(200);

    expect(
      response.body.map((note: { content: string }) => note.content),
    ).toEqual(['another item', 'home item']);
  });
});

describe('updating a dump', () => {
  it('updates the body, strips new markers and keeps the creation date', async () => {
    const created = await agent
      .post('/notes')
      .send({ content: 'buy coffee @home' })
      .expect(201);

    const response = await agent
      .patch(`/notes/${created.body.id}`)
      .send({ content: 'buy tea @home' })
      .expect(200);

    expect(response.body).toMatchObject({
      id: created.body.id,
      content: 'buy tea',
      createdAt: created.body.createdAt,
    });
    expect(response.body.groups).toEqual([
      { id: created.body.groups[0].id, name: 'home' },
    ]);
  });

  it('replaces the decks that are no longer in the body', async () => {
    const created = await agent
      .post('/notes')
      .send({ content: 'buy coffee @home @work' })
      .expect(201);

    const response = await agent
      .patch(`/notes/${created.body.id}`)
      .send({ content: 'buy coffee @work' })
      .expect(200);

    expect(response.body.groups).toEqual([
      { id: expect.any(String), name: 'work' },
    ]);

    const decks = await agent.get('/groups').expect(200);

    expect(decks.body).toEqual([
      { id: expect.any(String), name: 'work', count: 1 },
    ]);
  });

  it('connects the decks added to the body', async () => {
    const created = await agent
      .post('/notes')
      .send({ content: 'buy coffee @home' })
      .expect(201);

    const response = await agent
      .patch(`/notes/${created.body.id}`)
      .send({ content: 'buy coffee @home @urgent' })
      .expect(200);

    expect(
      response.body.groups.map((deck: { name: string }) => deck.name).sort(),
    ).toEqual(['home', 'urgent']);

    const decks = await agent.get('/groups').expect(200);

    expect(decks.body).toEqual([
      { id: expect.any(String), name: 'home', count: 1 },
      { id: expect.any(String), name: 'urgent', count: 1 },
    ]);
  });
});
