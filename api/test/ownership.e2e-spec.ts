import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, signedInAgent, truncateAll } from './test-app.js';

let app: INestApplication;
let prisma: PrismaService;
let alice: ReturnType<typeof request.agent>;
let bob: ReturnType<typeof request.agent>;

beforeAll(async () => {
  ({ app, prisma } = await createTestApp());
});

beforeEach(async () => {
  await truncateAll(prisma);
  alice = await signedInAgent(app, 'alice@example.com');
  bob = await signedInAgent(app, 'bob@example.com');
});

afterAll(async () => {
  await app.close();
});

describe('notes across users', () => {
  it("does not list another user's notes", async () => {
    await alice
      .post('/notes')
      .send({ content: 'alice note @home' })
      .expect(201);
    await bob.post('/notes').send({ content: 'bob note @work' }).expect(201);

    const response = await bob.get('/notes').expect(200);

    expect(
      response.body.map((note: { content: string }) => note.content),
    ).toEqual(['bob note']);
  });

  it("filters by group without leaking another user's notes", async () => {
    await alice
      .post('/notes')
      .send({ content: 'alice note @home' })
      .expect(201);
    await bob.post('/notes').send({ content: 'bob note @home' }).expect(201);

    const response = await bob.get('/notes?group=home').expect(200);

    expect(
      response.body.map((note: { content: string }) => note.content),
    ).toEqual(['bob note']);
  });

  it("cannot update another user's note", async () => {
    const created = await alice
      .post('/notes')
      .send({ content: 'alice note @home' })
      .expect(201);

    const response = await bob
      .patch(`/notes/${created.body.id}`)
      .send({ content: 'hijacked @home' })
      .expect(404);

    expect(response.body.message).toBe('Note not found');

    const notes = await alice.get('/notes').expect(200);
    expect(notes.body).toMatchObject([
      { id: created.body.id, content: 'alice note' },
    ]);
  });

  it("cannot delete another user's note", async () => {
    const created = await alice
      .post('/notes')
      .send({ content: 'alice note @home' })
      .expect(201);

    await bob.delete(`/notes/${created.body.id}`).expect(404);

    const notes = await alice.get('/notes').expect(200);
    expect(notes.body).toMatchObject([{ id: created.body.id }]);
  });
});

describe('groups across users', () => {
  it("does not list another user's groups", async () => {
    await alice
      .post('/notes')
      .send({ content: 'alice note @home' })
      .expect(201);
    await bob.post('/notes').send({ content: 'bob note @work' }).expect(201);

    const response = await bob.get('/groups').expect(200);

    expect(response.body).toEqual([
      { id: expect.any(String), name: 'work', count: 1 },
    ]);
  });

  it('keeps same-named groups separate per user', async () => {
    const aliceNote = await alice
      .post('/notes')
      .send({ content: 'alice note @home' })
      .expect(201);
    const bobNote = await bob
      .post('/notes')
      .send({ content: 'bob note @home' })
      .expect(201);

    expect(bobNote.body.groups[0].id).not.toBe(aliceNote.body.groups[0].id);

    const [aliceGroups, bobGroups] = await Promise.all([
      alice.get('/groups').expect(200),
      bob.get('/groups').expect(200),
    ]);

    expect(aliceGroups.body).toEqual([
      { id: aliceNote.body.groups[0].id, name: 'home', count: 1 },
    ]);
    expect(bobGroups.body).toEqual([
      { id: bobNote.body.groups[0].id, name: 'home', count: 1 },
    ]);
  });

  it("cannot delete another user's group", async () => {
    const created = await alice
      .post('/notes')
      .send({ content: 'alice note @home' })
      .expect(201);
    const groupId = created.body.groups[0].id;

    await bob.delete(`/groups/${groupId}`).expect(404);

    const groups = await alice.get('/groups').expect(200);
    expect(groups.body).toEqual([{ id: groupId, name: 'home', count: 1 }]);
  });
});
