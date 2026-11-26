import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

try {
  process.loadEnvFile(
    join(dirname(fileURLToPath(import.meta.url)), '..', '.env'),
  );
} catch {
  // .env is optional; host environment variables take precedence.
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const DEMO_USER = {
  id: 'demo-user',
  email: 'demo@flashnotes.app',
  // No password can ever match this placeholder: the demo is entered through
  // POST /auth/demo and password sign-in refuses the address before verifying.
  passwordHash: 'unusable-demo-password-hash',
};

const client = new pg.Client({ connectionString });

try {
  await client.connect();
  await client.query(
    `INSERT INTO "User" (id, email, "passwordHash", "isDemo")
     VALUES ($1, $2, $3, true)
     ON CONFLICT (email) DO UPDATE
       SET "isDemo" = true,
           "passwordHash" = EXCLUDED."passwordHash"`,
    [DEMO_USER.id, DEMO_USER.email, DEMO_USER.passwordHash],
  );
  console.log(`demo user ready: ${DEMO_USER.email}`);
} finally {
  await client.end();
}
