import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, truncateAll } from './test-app.js';

let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  ({ app, prisma } = await createTestApp());
});

beforeEach(async () => {
  await truncateAll(prisma);
});

afterAll(async () => {
  await app.close();
});

describe('signing up', () => {
  it('creates the account and returns it without the password hash', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/sign-up')
      .send({ email: 'ana@example.com', password: 'correct horse battery' })
      .expect(201);

    expect(response.body).toEqual({
      id: expect.any(String),
      email: 'ana@example.com',
    });
  });
});

describe('reading the current session', () => {
  it('returns no user when the browser is not signed in', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .expect(200);

    expect(response.body).toEqual({ user: null });
  });

  it('returns the signed-in user', async () => {
    const agent = request.agent(app.getHttpServer());
    const created = await agent
      .post('/auth/sign-up')
      .send({ email: 'ana@example.com', password: 'correct horse battery' })
      .expect(201);

    const response = await agent.get('/auth/me').expect(200);

    expect(response.body).toEqual({ user: created.body });
  });
});

describe('rejecting invalid credentials', () => {
  it('rejects an unknown email with the same message as a wrong password', async () => {
    await request(app.getHttpServer())
      .post('/auth/sign-up')
      .send({ email: 'ana@example.com', password: 'correct horse battery' })
      .expect(201);

    for (const body of [
      { email: 'ana@example.com', password: 'wrong password' },
      { email: 'unknown@example.com', password: 'correct horse battery' },
    ]) {
      const response = await request(app.getHttpServer())
        .post('/auth/sign-in')
        .send(body)
        .expect(401);

      expect(response.body.message).toBe('Invalid email or password');
    }
  });

  it('rejects an invalid sign-up payload', async () => {
    await request(app.getHttpServer())
      .post('/auth/sign-up')
      .send({ email: 'not-an-email', password: 'correct horse battery' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/auth/sign-up')
      .send({ email: 'ana@example.com', password: 'too short' })
      .expect(400);
  });

  it('rejects an email that is already registered, ignoring case', async () => {
    await request(app.getHttpServer())
      .post('/auth/sign-up')
      .send({ email: 'ana@example.com', password: 'correct horse battery' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/auth/sign-up')
      .send({ email: 'Ana@Example.com', password: 'correct horse battery' })
      .expect(409);

    expect(response.body.message).toBe('Email already registered');
  });
});

describe('signing out', () => {
  it('ends the session', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/sign-up')
      .send({ email: 'ana@example.com', password: 'correct horse battery' })
      .expect(201);

    await agent.post('/auth/sign-out').expect(204);

    const response = await agent.get('/auth/me').expect(200);
    expect(response.body).toEqual({ user: null });
  });
});

describe('protecting the app routes', () => {
  it('refuses notes without a session', async () => {
    await request(app.getHttpServer()).get('/notes').expect(401);
  });

  it('serves notes to a signed-in browser', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/sign-up')
      .send({ email: 'ana@example.com', password: 'correct horse battery' })
      .expect(201);

    await agent
      .post('/notes')
      .send({ content: 'buy coffee @home' })
      .expect(201);
  });
});

describe('signing in', () => {
  it('returns the user and keeps the browser signed in', async () => {
    const agent = request.agent(app.getHttpServer());
    const created = await agent
      .post('/auth/sign-up')
      .send({ email: 'ana@example.com', password: 'correct horse battery' })
      .expect(201);

    const response = await agent
      .post('/auth/sign-in')
      .send({ email: 'ana@example.com', password: 'correct horse battery' })
      .expect(200);

    expect(response.body).toEqual({
      user: { id: created.body.id, email: 'ana@example.com' },
      mfaRequired: false,
    });
  });

  it('matches the email regardless of case and surrounding spaces', async () => {
    await request(app.getHttpServer())
      .post('/auth/sign-up')
      .send({ email: 'ana@example.com', password: 'correct horse battery' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({
        email: '  Ana@Example.com  ',
        password: 'correct horse battery',
      })
      .expect(200);

    expect(response.body.user.email).toBe('ana@example.com');
  });
});
