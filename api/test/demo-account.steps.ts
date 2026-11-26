import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Step definitions for contracts/demo-account.feature, API side.
 *
 * Each helper executes one Given/When step from the feature. Assertions stay in
 * the spec so a failure names the scenario, not the helper.
 */

export const DEMO_USER = {
  id: 'demo-user',
  email: 'demo@flashnotes.app',
  isDemo: true,
};

export const ACCOUNT = {
  email: 'ana@example.com',
  password: 'correct horse battery',
};

export interface DemoWorld {
  app: INestApplication;
  prisma: PrismaService;
}

export type Visitor = ReturnType<typeof request.agent>;

export function client(world: DemoWorld) {
  return request(world.app.getHttpServer());
}

export function visitor(world: DemoWorld): Visitor {
  return request.agent(world.app.getHttpServer());
}

/**
 * Stands in for `npm run db:seed` until the command exists: it writes the same
 * row the command is contracted to write, so the assertions are about the row,
 * not about the entry point.
 */
export async function seedDemoUser(world: DemoWorld): Promise<void> {
  await world.prisma.$executeRawUnsafe(
    `INSERT INTO "User" (id, email, "passwordHash", "isDemo")
     VALUES ($1, $2, $3, true)
     ON CONFLICT (email) DO UPDATE SET "isDemo" = true`,
    DEMO_USER.id,
    DEMO_USER.email,
    'unusable-demo-password-hash',
  );
}

export async function removeDemoUser(world: DemoWorld): Promise<void> {
  await world.prisma.$executeRawUnsafe(
    'DELETE FROM "User" WHERE email = $1',
    DEMO_USER.email,
  );
}

export async function countDemoUsers(world: DemoWorld): Promise<number> {
  const rows = await world.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    'SELECT COUNT(*)::bigint AS count FROM "User" WHERE "isDemo" = true',
  );
  return Number(rows[0]?.count ?? 0);
}

export function enterDemo(world: DemoWorld, agent = visitor(world)) {
  return agent.post('/auth/demo');
}

export async function currentUser(agent: Visitor) {
  return agent.get('/auth/me');
}

export async function signUp(world: DemoWorld, email = ACCOUNT.email) {
  const agent = visitor(world);
  const response = await agent
    .post('/auth/sign-up')
    .send({ email, password: ACCOUNT.password });

  return { agent, response };
}

export function signIn(agent: Visitor, email: string, password: string) {
  return agent.post('/auth/sign-in').send({ email, password });
}

/** The attributes after the cookie value, normalised for comparison. */
export function cookieAttributes(headers: Record<string, unknown>): string {
  const header = headers['set-cookie'];
  const raw = Array.isArray(header) ? header[0] : header;
  if (typeof raw !== 'string') {
    throw new Error('Response did not set a cookie');
  }

  return raw
    .split(';')
    .slice(1)
    .map((attribute) => attribute.trim())
    .sort()
    .join('; ');
}

export function percentile95(durations: number[]): number {
  const sorted = [...durations].sort((left, right) => left - right);
  return (
    sorted[Math.ceil(sorted.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY
  );
}
