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
      .send({ content: 'buy coffee @casa' })
      .expect(201);

    expect(response.body).toMatchObject({
      content: 'buy coffee',
      groups: [{ name: 'casa' }],
    });
    expect(response.body.id).toEqual(expect.any(String));
    expect(response.body.createdAt).toEqual(expect.any(String));
  });

  it('reuses the existing deck instead of duplicating it', async () => {
    const first = await agent
      .post('/notes')
      .send({ content: 'buy coffee @Casa' })
      .expect(201);

    const second = await agent
      .post('/notes')
      .send({ content: 'clean kitchen @casa' })
      .expect(201);

    expect(first.body.groups).toEqual([
      { id: expect.any(String), name: 'casa' },
    ]);
    expect(second.body.groups).toEqual([
      { id: first.body.groups[0].id, name: 'casa' },
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
    for (const content of ['@casa buy coffee', 'buy coffee @casa now']) {
      const response = await agent.post('/notes').send({ content }).expect(400);

      expect(response.body.message).toBe(
        'Include at least one @group in the note',
      );
    }
  });

  it('rejects a dump whose whole body is the marker', async () => {
    const response = await agent
      .post('/notes')
      .send({ content: '  @casa @trabalho  ' })
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
    await agent.post('/notes').send({ content: 'first @casa' }).expect(201);

    await agent.post('/notes').send({ content: 'second @casa' }).expect(201);

    const response = await agent.get('/notes').expect(200);

    expect(
      response.body.map((note: { content: string }) => note.content),
    ).toEqual(['second', 'first']);
    expect(response.body[0].groups).toEqual([
      { id: expect.any(String), name: 'casa' },
    ]);
  });

  it('filters dumps by deck, ignoring case', async () => {
    await agent.post('/notes').send({ content: 'home item @casa' }).expect(201);
    await agent
      .post('/notes')
      .send({ content: 'work item @trabalho' })
      .expect(201);
    await agent
      .post('/notes')
      .send({ content: 'another item @Casa' })
      .expect(201);

    const response = await agent.get('/notes?group=Casa').expect(200);

    expect(
      response.body.map((note: { content: string }) => note.content),
    ).toEqual(['another item', 'home item']);
  });
});

describe('updating a dump', () => {
  it('updates the body, strips new markers and keeps the creation date', async () => {
    const created = await agent
      .post('/notes')
      .send({ content: 'buy coffee @casa' })
      .expect(201);

    const response = await agent
      .patch(`/notes/${created.body.id}`)
      .send({ content: 'buy tea @casa' })
      .expect(200);

    expect(response.body).toMatchObject({
      id: created.body.id,
      content: 'buy tea',
      createdAt: created.body.createdAt,
    });
    expect(response.body.groups).toEqual([
      { id: created.body.groups[0].id, name: 'casa' },
    ]);
  });

  it('replaces the decks that are no longer in the body', async () => {
    const created = await agent
      .post('/notes')
      .send({ content: 'buy coffee @casa @trabalho' })
      .expect(201);

    const response = await agent
      .patch(`/notes/${created.body.id}`)
      .send({ content: 'buy coffee @trabalho' })
      .expect(200);

    expect(response.body.groups).toEqual([
      { id: expect.any(String), name: 'trabalho' },
    ]);

    const decks = await agent.get('/groups').expect(200);

    expect(decks.body).toEqual([
      { id: expect.any(String), name: 'trabalho', count: 1 },
    ]);
  });

  it('connects the decks added to the body', async () => {
    const created = await agent
      .post('/notes')
      .send({ content: 'buy coffee @casa' })
      .expect(201);

    const response = await agent
      .patch(`/notes/${created.body.id}`)
      .send({ content: 'buy coffee @casa @urgente' })
      .expect(200);

    expect(
      response.body.groups.map((deck: { name: string }) => deck.name).sort(),
    ).toEqual(['casa', 'urgente']);

    const decks = await agent.get('/groups').expect(200);

    expect(decks.body).toEqual([
      { id: expect.any(String), name: 'casa', count: 1 },
      { id: expect.any(String), name: 'urgente', count: 1 },
    ]);
  });
});
