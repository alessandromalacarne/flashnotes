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

describe('listing decks', () => {
  it('lists decks with counts, most used first and tie-broken by name', async () => {
    await agent.post('/notes').send({ content: 'first @home' }).expect(201);
    await agent.post('/notes').send({ content: 'second @home' }).expect(201);
    await agent.post('/notes').send({ content: 'third @work' }).expect(201);
    await agent.post('/notes').send({ content: 'fourth @aaa' }).expect(201);

    const response = await agent.get('/groups').expect(200);

    expect(response.body).toEqual([
      { id: expect.any(String), name: 'home', count: 2 },
      { id: expect.any(String), name: 'aaa', count: 1 },
      { id: expect.any(String), name: 'work', count: 1 },
    ]);
  });

  it('returns an empty list when there are no decks', async () => {
    const response = await agent.get('/groups').expect(200);

    expect(response.body).toEqual([]);
  });
});

describe('deleting decks', () => {
  it('deletes a deck without deleting its dumps', async () => {
    await agent
      .post('/notes')
      .send({ content: 'buy coffee @home' })
      .expect(201);
    await agent
      .post('/notes')
      .send({ content: 'write the report @work' })
      .expect(201);

    const decks = await agent.get('/groups').expect(200);
    const home = decks.body.find(
      (deck: { name: string }) => deck.name === 'home',
    );

    await agent.delete(`/groups/${home.id}`).expect(204);

    const remainingDecks = await agent.get('/groups').expect(200);
    expect(
      remainingDecks.body.map((deck: { name: string }) => deck.name),
    ).toEqual(['work']);

    const dumps = await agent.get('/notes').expect(200);
    expect(dumps.body.map((note: { content: string }) => note.content)).toEqual(
      ['write the report', 'buy coffee'],
    );
    expect(dumps.body[1].groups).toEqual([]);
  });

  it('returns 404 when deleting a deck that does not exist', async () => {
    await agent
      .delete('/groups/01920000-0000-7000-8000-000000000000')
      .expect(404);
  });
});
