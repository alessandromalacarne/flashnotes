# quickdump

Capture thoughts in seconds, retrieve them by deck later.

A "dump" is a short note that ends with at least one `@deck` marker. Type it, hit Enter, done. The marker only points at the deck: the body that gets saved holds the text alone. Dumps are grouped by deck for later processing (e.g. assembling a post from the dumps of `@blog`).

## Stack

- **api/** — NestJS 12 + Prisma 7 + PostgreSQL, TypeScript ESM
- **web/** — React 19 + Vite 8 + Tailwind CSS 4, TypeScript

## Structure

```
api/                 REST API (dumps + decks + workflows)
  prisma/            schema and migrations
  src/dumps/         POST /dumps, GET /dumps?deck=, PATCH /dumps/:id, DELETE /dumps/:id
  src/decks/         GET /decks, DELETE /decks/:id
  src/workflows/     rules engine: triggers, actions, scheduler, run history
  test/              e2e tests (supertest + real Postgres)
web/                 SPA: composer, deck pages, workflows page, dark theme
scripts/pg.sh        Local Postgres via nix (init/start/stop/reset)
scripts/workflows/   scripts a workflow may run (see its README)
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

Vite proxies `/api` to `localhost:3000`.

## Tests

```bash
cd api && npm test           # unit (deck parser, triggers, cron, export format, scripts)
cd api && npm run test:e2e   # e2e with real Postgres (uses quickdump_test)
cd web && npm test           # components and flows (jsdom + Testing Library)
```

## API

| Method | Route                    | Description                                        |
| ------ | ------------------------ | -------------------------------------------------- |
| POST   | `/dumps`                 | Creates a dump. `{ "content": "buy coffee @casa" }` → 201 `content: "buy coffee"` |
| GET    | `/dumps`                 | Lists dumps, newest first                          |
| GET    | `/dumps?deck=home`       | Filters by deck (case-insensitive)                 |
| PATCH  | `/dumps/:id`             | Replaces the content. `{ "content": "buy tea @casa" }` → 200 |
| DELETE | `/dumps/:id`             | Deletes a dump → 204                               |
| GET    | `/decks`                 | Decks with counts, most used first                 |
| DELETE | `/decks/:id`             | Deletes a deck, keeps its dumps → 204              |
| GET    | `/workflows`             | Workflow rules with their deck scope               |
| POST   | `/workflows`             | Creates a rule → 201                               |
| PATCH  | `/workflows/:id`         | Edits a rule, enables/disables it                  |
| DELETE | `/workflows/:id`         | Deletes a rule and its run history → 204           |
| GET    | `/workflows/:id/runs`    | Run history, newest first (`?limit=`, max 100)     |
| POST   | `/workflows/:id/run`     | Runs it right now → 202 `{ "runId": "…" }`         |
| GET    | `/scripts`               | Scripts available to workflows, with descriptions  |

Validation errors return 400. Dump without a deck: `{"message": "Include at least one @deck in the dump"}`; dump whose whole body is the marker: `{"message": "The dump needs text besides the @deck"}`. Unknown dump on PATCH/DELETE: 404 `{"message": "Dump not found"}`.

## Workflows

A workflow is a rule: **when** something happens, **do** something.

```jsonc
// when a dump lands on @casa, run scripts/workflows/notify.sh
{ "name": "notify casa", "event": "dumpCreated", "decks": ["casa"],
  "action": "script", "config": { "script": "notify.sh", "args": ["--quiet"] } }

// every day at 23:59, write the day's @casa dumps to a text file
{ "name": "daily casa export", "cron": "59 23 * * *", "timezone": "America/Sao_Paulo",
  "decks": ["casa"], "action": "export", "config": { "window": "day" } }
```

- **Triggers** — `event` (`dumpCreated`, `deckDeleted`) or `cron` + `timezone`, never both.
- **Deck scope** — `decks: []` means every deck. It filters the event *and* what an export covers.
- **Actions** — `script` (a file from `scripts/workflows/`, optional `args`, `cwd`, `timeoutMs`)
  or `export` (a plain text file of the window's dumps, `window` being `sinceLastRun`, `day` or `all`).
- Reports are kept per run: status, exit code, `stdout`, `stderr` and the file written.
- A failed workflow never fails the request that triggered it — the dump is saved either way.
- If the API was down when a schedule was due, it catches up once on the next start, over the
  whole missed window.
- Scheduled runs are polled every 30s (`QUICKDUMP_SCHEDULER=off` turns the poller off).
- The whole workflows feature can be disabled with `QUICKDUMP_WORKFLOWS=off` (API routes, scheduler, triggers and the UI link). Defaults to on.

⚠️ A workflow runs a script with the API's own privileges, and the API has no authentication.
It binds to `127.0.0.1` by default for that reason — set `HOST=0.0.0.0` only if you trust
everything that can reach the port. See `scripts/workflows/README.md` for the script contract.

## Notes

- Decks come from the trailing markers (`@home` → `home`), lowercased, no duplicates. Only markers at the end of the dump count: `buy coffee @casa @trabalho` links both decks, while `@casa buy coffee` and `buy coffee @casa now` have no deck at all. The markers are stripped from the body before it is saved, so a dump stores plain text and its decks as a relation. A deck whose last dump is edited away or deleted is removed from `/decks`, and a workflow watching that deck hears about it like any other deletion.
- Only a marker at the end links a deck: `#casa`, `foo@bar.com` and a marker followed by punctuation are plain text.
- Web UI: dark theme, composer (Enter sends, Shift+Enter breaks the line, clicking anywhere focuses the field), deck pages and a workflows page to create rules and read their runs.
- `/deck/:deck` lists the dumps of a deck with an empty composer (type the trailing marker yourself), inline editing and delete behind a `confirm?` step.
- Export files render each dump's decks in the header (`@casa`), because the body no longer carries them.
- Single-user: no authentication in this version.
- Prisma commands load `api/.env` automatically (values already in the environment win), so `npm run prisma:generate` and `npm run db:migrate` work on any OS.
- On NixOS, Prisma cannot download its engines. The `flake.nix` devShell exports `PRISMA_SCHEMA_ENGINE_BINARY`, so run Prisma commands inside `nix develop`.
