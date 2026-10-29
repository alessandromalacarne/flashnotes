# quickdump

Capture thoughts in seconds, retrieve them by deck later.

A "dump" is a short note that ends with at least one `@deck` marker. Type it, hit Enter, done. The marker only points at the deck: the body that gets saved holds the text alone. Dumps are grouped by deck for later processing (e.g. assembling a post from the dumps of `@blog`).

## Stack

- **api/** — NestJS 12 + Prisma 7 + PostgreSQL, TypeScript ESM
- **web/** — React 19 + Vite 8 + Tailwind CSS 4, TypeScript
- **auth** — cookie sessions via `@nestjs/authentication` (sign-up, sign-in, sign-out)

## Structure

```
api/                 REST API (auth + dumps + decks)
  prisma/            schema and migrations
  src/auth/          POST /auth/sign-up, POST /auth/sign-in, GET /auth/me, POST /auth/sign-out
  src/users/         user repository and Prisma-backed credentials
  src/dumps/         POST /dumps, GET /dumps?deck=, PATCH /dumps/:id, DELETE /dumps/:id
  src/decks/         GET /decks, DELETE /decks/:id
  test/              e2e tests (supertest + real Postgres, signed-in agent)
web/                 SPA: landing, login/signup, composer and deck pages
  src/auth/          session context, route guards
scripts/pg.sh        Local Postgres via nix (init/start/stop/reset)
compose.yaml         Postgres via Docker, alternative to pg.sh
flake.nix            devShell (Node 24 + Postgres + Prisma engines)
```

## Running

Prerequisites: Node 24+, and Postgres in one of two ways:

```bash
# Option 0 — nix devShell (Node, Postgres and Prisma engines ready to go)
nix develop

# Option A — local Postgres via nix (no Docker)
./scripts/pg.sh start        # creates the quickdump and quickdump_test databases

# Option B — Docker
docker compose up -d
```

Then:

```bash
cd api
cp .env.example .env
npm install
npm run prisma:generate
npm run db:migrate
npm run start:dev            # API at http://localhost:3000

cd ../web
npm install
npm run dev                  # app at http://localhost:5173
```

Vite proxies `/api` to `127.0.0.1:3000`.

## Routes

| Route               | Description                                              |
| ------------------- | -------------------------------------------------------- |
| `/`                 | Public landing page                                      |
| `/login`            | Sign in                                                  |
| `/signup`           | Create an account (password: 12–128 characters)          |
| `/app`              | Composer, requires a session                             |
| `/app/decks`        | Decks, requires a session                                |
| `/app/deck/:deck`   | Dumps of a deck, requires a session                      |

Anonymous visits to `/app/**` redirect to `/login`; signing in returns to the requested page.

## Tests

```bash
cd api && npm test           # unit (deck parser)
cd api && npm run test:e2e   # e2e with real Postgres (uses quickdump_test)
cd web && npm test           # components and flows (jsdom + Testing Library)
```

## API

| Method | Route                    | Description                                        |
| ------ | ------------------------ | -------------------------------------------------- |
| POST   | `/auth/sign-up`          | Creates an account, signs in and returns the user  |
| POST   | `/auth/sign-in`          | `{ "email", "password" }` → 200 `{ "user", "mfaRequired": false }` |
| GET    | `/auth/me`               | The signed-in user, or `{ "user": null }`          |
| POST   | `/auth/sign-out`         | Ends the session → 204                             |
| POST   | `/dumps`                 | Creates a dump. `{ "content": "buy coffee @casa" }` → 201 `content: "buy coffee"` |
| GET    | `/dumps`                 | Lists dumps, newest first                          |
| GET    | `/dumps?deck=home`       | Filters by deck (case-insensitive)                 |
| PATCH  | `/dumps/:id`             | Replaces the content. `{ "content": "buy tea @casa" }` → 200 |
| DELETE | `/dumps/:id`             | Deletes a dump → 204                               |
| GET    | `/decks`                 | Decks with counts, most used first                 |
| DELETE | `/decks/:id`             | Deletes a deck, keeps its dumps → 204              |

Every route except the four `/auth` ones requires a live session cookie; without it the API answers 401. Sign-up rejects a duplicate email with 409 and invalid payloads with 400; sign-in rejects bad credentials with 401 `Invalid email or password`.

Validation errors return 400. Dump without a deck: `{"message": "Include at least one @deck in the dump"}`; dump whose whole body is the marker: `{"message": "The dump needs text besides the @deck"}`. Unknown dump on PATCH/DELETE: 404 `{"message": "Dump not found"}`.

## Notes

- Decks come from the trailing markers (`@home` → `home`), lowercased, no duplicates. Only markers at the end of the dump count: `buy coffee @casa @trabalho` links both decks, while `@casa buy coffee` and `buy coffee @casa now` have no deck at all. The markers are stripped from the body before it is saved, so a dump stores plain text and its decks as a relation. A deck whose last dump is edited away or deleted is removed from `/decks`.
- Only a marker at the end links a deck: `#casa`, `foo@bar.com` and a marker followed by punctuation are plain text.
- Web UI: dark theme, public landing page, login/signup, composer (Enter sends, Shift+Enter breaks the line, clicking anywhere focuses the field) and deck pages.
- `/app/deck/:deck` lists the dumps of a deck with an empty composer (type the trailing marker yourself), inline editing and delete behind a `confirm?` step.
- Export files render each dump's decks in the header (`@casa`), because the body no longer carries them.
- Accounts use server-side cookie sessions (`HttpOnly`, `SameSite=Lax`): 3-day idle timeout, 14-day absolute lifetime. The cookie is `Secure` and uses the `__Host-` prefix when `NODE_ENV=production`; development uses a plain `sid` cookie so the Vite proxy on `http://localhost` works.
- Sessions and password hashing are owned by `@nestjs/authentication`; the session store is in-memory for now, so a restart signs everyone out.
- Prisma commands load `api/.env` automatically (values already in the environment win), so `npm run prisma:generate` and `npm run db:migrate` work on any OS.
- On NixOS, Prisma cannot download its engines. The `flake.nix` devShell exports `PRISMA_SCHEMA_ENGINE_BINARY`, so run Prisma commands inside `nix develop`.
