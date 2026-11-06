import type { INestApplication } from '@nestjs/common';
import http from 'node:http';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { createTestApp } from './test-app.js';

let app: INestApplication;
let port: number;

beforeAll(async () => {
  ({ app } = await createTestApp());
  await app.listen(0, '127.0.0.1');

  const address = app.getHttpServer().address();
  if (address === null || typeof address === 'string') {
    throw new Error('The test server did not expose a TCP port');
  }
  port = address.port;
});

afterAll(async () => {
  await app.close();
});

function sendCompressed(first: Buffer, trailing: Buffer): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: '127.0.0.1',
        port,
        path: '/auth/sign-in',
        method: 'POST',
        agent: false,
        headers: {
          'Content-Type': 'application/json',
          'Content-Encoding': 'gzip',
          'Content-Length': first.length + trailing.length,
        },
      },
      (response) => {
        response.resume();
        response.on('end', () => resolve(response.statusCode ?? 0));
      },
    );

    request.on('error', reject);
    // The first segment ends the gzip stream; the trailing bytes reach the
    // decompressor after it is done, which crashed body-parser before 2.4.0.
    request.write(first);
    setTimeout(() => request.end(trailing), 30);
  });
}

describe('compressed request bodies', () => {
  it('survives trailing bytes after the gzip frame', async () => {
    const json = Buffer.from(
      '{"email":"nobody@example.com","password":"wrong password"}',
    );
    const first = Buffer.concat([gzipSync(json), Buffer.from([0x00])]);

    const status = await sendCompressed(first, Buffer.alloc(1024, 0x58));

    expect([400, 401]).toContain(status);
  });
});
