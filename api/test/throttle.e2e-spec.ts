import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

// The throttle limits are read when the app module is first imported, so this
// file lowers the auth budget before loading it and restores the environment
// right after, keeping the rest of the suite on the generous test limits.
const previousAuthLimit = process.env.AUTH_THROTTLE_LIMIT;
process.env.AUTH_THROTTLE_LIMIT = '3';

const { createTestApp } = await import('./test-app.js');

process.env.AUTH_THROTTLE_LIMIT = previousAuthLimit;

let app: INestApplication;

beforeAll(async () => {
  ({ app } = await createTestApp());
});

afterAll(async () => {
  await app.close();
});

describe('auth throttling', () => {
  it('answers 429 with Retry-After once the budget is spent', async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/auth/sign-in')
        .send({ email: 'nobody@example.com', password: 'wrong password' });

    for (let count = 0; count < 3; count += 1) {
      await attempt().expect(401);
    }

    const blocked = await attempt().expect(429);

    expect(blocked.headers['retry-after']).toBeDefined();
  });
});
