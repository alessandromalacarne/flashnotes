# flashnotes

Capture thoughts in seconds, retrieve them by group later.

A "note" is a short note that ends with at least one `@group` marker. Type it, hit Enter, done. The marker only points at the group: the body that gets saved holds the text alone. Notes are grouped by group for later processing (e.g. assembling a post from the notes of `@blog`).

## Stack

- **api/** — NestJS 12 + Prisma 7 + PostgreSQL, TypeScript ESM
- **web/** — React 19 + Vite 8 + Tailwind CSS 4, TypeScript
- **auth** — cookie sessions via `@nestjs/authentication` (sign-up, sign-in, sign-out)

## Structure

```
api/                 REST API (auth + notes + groups)
  prisma/            schema and migrations
  src/auth/          POST /auth/sign-up, POST /auth/sign-in, GET /auth/me, POST /auth/sign-out
  src/users/         user repository and Prisma-backed credentials
  src/notes/         POST /notes, GET /notes?group=, PATCH /notes/:id, DELETE /notes/:id
  src/groups/         GET /groups, DELETE /groups/:id
  test/              e2e tests (supertest + real Postgres, signed-in agent)
web/                 SPA: landing, login/signup, composer and group pages
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
| `/app/groups`        | Groups, requires a session                                |
| `/app/group/:group`   | Notes of a group, requires a session                      |

Anonymous visits to `/app/**` redirect to `/login`; signing in returns to the requested page.

## Tests

```bash
cd api && npm test           # unit (group parser)
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
| POST   | `/notes`                 | Creates a note. `{ "content": "buy coffee @home" }` → 201 `content: "buy coffee"` |
| GET    | `/notes`                 | Lists notes, newest first                          |
| GET    | `/notes?group=home`       | Filters by group (case-insensitive)                 |
| PATCH  | `/notes/:id`             | Replaces the content. `{ "content": "buy tea @home" }` → 200 |
| DELETE | `/notes/:id`             | Deletes a note → 204                               |
| GET    | `/groups`                 | Groups with counts, most used first                 |
| DELETE | `/groups/:id`             | Deletes a group, keeps its notes → 204              |

Every route except the four `/auth` ones requires a live session cookie; without it the API answers 401. Sign-up rejects a duplicate email with 409 and invalid payloads with 400; sign-in rejects bad credentials with 401 `Invalid email or password`.

Validation errors return 400. Note without a group: `{"message": "Include at least one @group in the note"}`; note whose whole body is the marker: `{"message": "The note needs text besides the @group"}`. Unknown note on PATCH/DELETE: 404 `{"message": "Note not found"}`.

## Notes

- Groups come from the trailing markers (`@home` → `home`), lowercased, no duplicates. Only markers at the end of the note count: `buy coffee @home @work` links both groups, while `@home buy coffee` and `buy coffee @home now` have no group at all. The markers are stripped from the body before it is saved, so a note stores plain text and its groups as a relation. A group whose last note is edited away or deleted is removed from `/groups`.
- Only a marker at the end links a group: `#home`, `foo@bar.com` and a marker followed by punctuation are plain text.
- Web UI: dark theme, public landing page, login/signup, composer (Enter sends, Shift+Enter breaks the line, clicking anywhere focuses the field) and group pages.
- `/app/group/:group` lists the notes of a group with an empty composer (type the trailing marker yourself), inline editing and delete behind a `confirm?` step.
- Export files render each note's groups in the header (`@home`), because the body no longer carries them.
- Accounts use server-side cookie sessions (`HttpOnly`, `SameSite=Lax`): 3-day idle timeout, 14-day absolute lifetime. The cookie is `Secure` and uses the `__Host-` prefix when `NODE_ENV=production`; development uses a plain `sid` cookie so the Vite proxy on `http://localhost` works.
- Sessions and password hashing are owned by `@nestjs/authentication`; the session store is in-memory for now, so a restart signs everyone out.
- Prisma commands load `api/.env` automatically (values already in the environment win), so `npm run prisma:generate` and `npm run db:migrate` work on any OS.
- On NixOS, Prisma cannot download its engines. The `flake.nix` devShell exports `PRISMA_SCHEMA_ENGINE_BINARY`, so run Prisma commands inside `nix develop`.
