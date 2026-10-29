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
    await agent.post('/dumps').send({ content: 'first @casa' }).expect(201);
    await agent.post('/dumps').send({ content: 'second @casa' }).expect(201);
    await agent.post('/dumps').send({ content: 'third @trabalho' }).expect(201);
    await agent.post('/dumps').send({ content: 'fourth @aaa' }).expect(201);

    const response = await agent.get('/decks').expect(200);

    expect(response.body).toEqual([
      { id: expect.any(String), name: 'casa', count: 2 },
      { id: expect.any(String), name: 'aaa', count: 1 },
      { id: expect.any(String), name: 'trabalho', count: 1 },
    ]);
  });

  it('returns an empty list when there are no decks', async () => {
    const response = await agent.get('/decks').expect(200);

    expect(response.body).toEqual([]);
  });
});

describe('deleting decks', () => {
  it('deletes a deck without deleting its dumps', async () => {
    await agent
      .post('/dumps')
      .send({ content: 'buy coffee @casa' })
      .expect(201);
    await agent
      .post('/dumps')
      .send({ content: 'write the report @trabalho' })
      .expect(201);

    const decks = await agent.get('/decks').expect(200);
    const casa = decks.body.find(
      (deck: { name: string }) => deck.name === 'casa',
    );

    await agent.delete(`/decks/${casa.id}`).expect(204);

    const remainingDecks = await agent.get('/decks').expect(200);
    expect(
      remainingDecks.body.map((deck: { name: string }) => deck.name),
    ).toEqual(['trabalho']);

    const dumps = await agent.get('/dumps').expect(200);
    expect(dumps.body.map((dump: { content: string }) => dump.content)).toEqual(
      ['write the report', 'buy coffee'],
    );
    expect(dumps.body[1].decks).toEqual([]);
  });

  it('returns 404 when deleting a deck that does not exist', async () => {
    await agent
      .delete('/decks/01920000-0000-7000-8000-000000000000')
      .expect(404);
  });
});
