# AGENTS.md

flashnotes captures short notes and groups them by `@group`. A note is valid only when it ends with at least one `@group` marker; the marker is stripped before saving and the group relation is stored separately.

## Core Principles

- **Keep changes minimal and tightly scoped.** Make the smallest useful diff. Don't add features, refactor unrelated code, or create abstractions unless explicitly asked.
- **Project rules override global preferences.** If a rule conflicts with a user request, follow the rule and explain why.
- **If unsure, inspect the codebase** instead of inventing patterns.
- **Never edit generated code.** The Prisma client is generated into `api/src/generated/prisma` (gitignored) — rerun `npm run prisma:generate` instead.
- **ESM imports must end in `.js`** even though the source is `.ts` (`module: nodenext`). Omitting the extension breaks at runtime.
- **Every route is protected by default.** Only `POST /auth/sign-up` and `POST /auth/sign-in` are `@Public()`. New routes without a guard are a security bug.
- **Public user reads must `select: { id, email }`.** Omitting `select` leaks `passwordHash`.
- **Shared domain rules live in `core/`.** Note/group parsing, note validation, limits and the `User` type are imported from `@flashnotes/core` by both `api` and `web`; never re-implement them in a package. After changing `core/src`, run `npm run build` in `core/` before typechecking or testing `api`/`web`.
- **Don't revert unrelated changes.** Uncommitted changes are the user's review state.

## Repository layout

| Path                            | What it is                                                  |
| ------------------------------- | ----------------------------------------------------------- |
| `api/`                          | NestJS 12 + Prisma 7 + PostgreSQL, ESM TypeScript           |
| `web/`                          | React 19 + Vite 8 + Tailwind 4 SPA, TypeScript              |
| `core/`                         | `@flashnotes/core`: domain rules shared by `api` and `web`  |
| `api/prisma/`                   | Schema and migrations                                       |
| `api/test/`                     | e2e suites (supertest + real Postgres)                      |
| `scripts/pg.sh`                 | Local Postgres (`start`, `stop`, `status`, `reset`)         |
| `compose.yaml`                  | Postgres via Docker (alternative to `pg.sh`)                |
| `flake.nix`                     | devShell: Node 24, Postgres 17, Prisma engines              |
| `.mido.toml`                    | Guardrails ladder configuration                             |
| `.github/workflows/ci.yml`      | CI: mido guardrails ladder and `npm audit` for each package |
| `package.json`                  | Root version only (release-please; no workspace)            |
| `release-please-config.json`    | Release PR configuration and changelog sections             |
| `.release-please-manifest.json` | Last released version, read by release-please               |

There is no root workspace. The root `package.json` holds the release version only; each package owns its own lockfile and install step.

## Setup and commands

```bash
# Database: pick one
nix develop                  # dev shell with Node, Postgres and Prisma engines
./scripts/pg.sh start        # creates flashnotes and flashnotes_test
docker compose up -d         # alternative

# Core (shared domain rules)
cd core
npm install
npm run build                # required before api/web typecheck, test or build

# API
cd api
cp .env.example .env
npm install
npm run prisma:generate      # required after install and after schema changes
npm run db:migrate
npm run start:dev            # http://127.0.0.1:3000

# Web
cd web
npm install
npm run dev                  # http://localhost:5173, proxies /api to the API
```

Validation per package:

| Check      | Core                                | API                                 | Web                       |
| ---------- | ----------------------------------- | ----------------------------------- | ------------------------- |
| Unit tests | `npm test`                          | `npm test` (`*.spec.ts`)            | `npm test` (`*.test.tsx`) |
| e2e tests  | —                                   | `npm run test:e2e`                  | —                         |
| Lint       | `npm run lint` (oxlint)             | `npm run lint` (oxlint, type-aware) | `npm run lint` (oxlint)   |
| Types      | `npx tsc --noEmit -p tsconfig.json` | `npx tsc --noEmit -p tsconfig.json` | `npx tsc -b`              |
| Format     | `npx prettier --check src`          | `npx prettier --check src test`     | `npx prettier --check .`  |
| Build      | `npm run build`                     | `npm run build`                     | `npm run build`           |

Guardrails gate: run `mido --lang typescript -p core`, `mido --lang typescript -p api` and `mido --lang typescript -p web`. A change is not done until every affected target reports `SHIP-READY`. The API target measures the Redis session store too, so run it with `REDIS_URL` set like CI does (`REDIS_URL=redis://:redis@127.0.0.1:6379` for the compose instance); without it the measured surface is incomplete. Thresholds live in `.mido.toml`: file 300/500 LOC, function 40/60 LOC, complexity 10/15, nesting 3/4, cognitive complexity 15, coverage 80%. Keep functions small; when one crosses the limit, split along behavior, not by moving JSX into another file.

## API architecture

Feature modules under `api/src/<feature>/`, each with `*.module.ts`, `*.controller.ts`, `*.service.ts`, and DTOs in `dto/`. Data access belongs in a `*Repository` class (`users/users.repository.ts`); services orchestrate, controllers only translate HTTP. `PrismaModule` is global.

- ESM with `module: nodenext`: relative imports must end in `.js` (see Core Principles).
- Prisma client is generated into `api/src/generated/prisma` (gitignored). Never edit it; rerun `npm run prisma:generate` (see Core Principles).
- Global `ValidationPipe({ whitelist: true, transform: true })` is installed in `src/setup.ts`. DTO validation uses `class-validator`; `@Transform` runs before validators, which is why email trimming lives there.
- Errors are Nest HTTP exceptions with a human-readable message: `400` for invalid dumps, `404` for unknown dump/deck, `401` for bad credentials, `409` for duplicate email, `204` for deletes/sign-out.

### Auth

`@nestjs/authentication` provides cookie sessions and installs a global guard. Every route is protected by default (see Core Principles).

- `@Public()` only on `POST /auth/sign-up` and `POST /auth/sign-in`.
- `GET /auth/me` uses `@Authenticate({ optional: true })` and returns `200 { user: null }` for anonymous callers — not 401.
- New e2e tests must use `signedInAgent(app)` from `test/test-app.ts`; a bare `request(app.getHttpServer())` gets 401.
- `truncateAll()` must clear `User` along with `Dump` and `Deck`.
- Cookie is `Secure`/`__Host-` only when `NODE_ENV=production`. The e2e config pins `NODE_ENV=test` so supertest sends the plain `sid` cookie over HTTP.
- Emails are trimmed in the DTO, then NFC-normalized and lowercased in `UsersRepository` — prevents duplicate accounts from unicode variants.
- Sessions are in-memory: restarting the API signs everyone out. Dumps and decks are not user-scoped yet.

### Notes, groups and the shared core

`core/src/group-parser.ts` is the source of truth for markers. Only markers at the end count (`buy coffee @home` yes; `@home buy coffee` no), names are lowercased and deduplicated, and the body is stored without them. `core/src/parse-note.ts` holds the validation order and the exact error messages — the API maps them to `BadRequestException` (400) and the web composer renders them, so the wording is a contract. Limits and the auth limits live in `core/src/note-limits.ts` and `core/src/auth-limits.ts`; the DTOs, the SQLite store and the sign-up form all read them from `@flashnotes/core`.

`core` is a real package (`core/package.json`, `exports` → `dist`). `api` and `web` depend on it with `file:../core`, so it must be built (`npm run build` in `core/`) before either package typechecks, tests or builds — CI builds it before the api/web ladders. On update/delete, orphan groups are removed inside the same transaction by each store.

## Web architecture

- `src/api.ts` is the only HTTP client. Reuse `request()` and `errorMessage()`; don't call `fetch` from components — centralizes error handling and base URL.
- Routing uses `react-router` (v8 package name, not `react-router-dom`). Public: `/`, `/login`, `/signup`. Protected: `/app`, `/app/decks`, `/app/deck/:deck` behind `RequireAuth`; auth pages sit behind `PublicOnly`.
- Redirect targets go through `returnTo()`; never navigate to a raw `location.state` — prevents open redirect vulnerabilities.
- Vite proxy targets `http://127.0.0.1:3000` and rewrites `/api`. Do not add `changeOrigin`: the API's CSRF check compares `Origin` and `Host`.
- Components in `src/components/`, pages in `src/pages/`, session context and guards in `src/auth/`.
- User-visible errors come from thrown `Error` messages rendered with `role="alert"`; keep that pattern.

## Testing

- Vitest everywhere, with `globals: true`. There is no Jest.
- API unit specs are co-located (`src/auth/session.store.spec.ts`). API e2e lives in `api/test/*.e2e-spec.ts`, runs serially (`fileParallelism: false`) against `flashnotes_test`, and runs `prisma migrate deploy` in global setup. Override with `TEST_DATABASE_URL`.
- Core specs are co-located in `core/src/*.spec.ts` and run with the package's own Vitest config.
- Web tests are co-located (`*.test.ts`, `*.test.tsx`, `*.spec.ts`), jsdom + Testing Library; setup in `src/test/setup.ts`.
- Test observable behavior and error paths. Repo convention keeps `test(...)` commits separate from `feat(...)` commits.

## Conventions

- Conventional commits with a scope: `feat(api):`, `feat(web):`, `feat(core):`, `test(api):`, `docs:`, `chore:`. Work on a feature branch and open a PR; CI runs on pushes to `master` and on PRs.
- Releases are automated by release-please on `master`: it opens a release PR from the conventional commits, and merging it writes `CHANGELOG.md`, tags `vX.Y.Z` and publishes the GitHub release. `CHANGELOG.md` and the version in the root `package.json`, `api/package.json`, `core/package.json` and `web/package.json` are generated — edit them only through the release PR.
- TypeScript strict mode; avoid `any` and non-null assertions where a narrow type works — strict mode catches null/undefined errors at compile time.
- Comments only where the reasoning is non-obvious (see `notes.service.ts`, `core/src/group-parser.ts`) — code should be self-documenting.
- `WALKTHROUGH.md` is gitignored and intentionally untracked; it is a local living document, not part of the diff.
- On NixOS, run Prisma commands inside `nix develop` — the devShell exports `PRISMA_SCHEMA_ENGINE_BINARY` because Prisma cannot download engines there.

## Gotchas

- `api/.env` is optional in production; `main.ts` loads it via `process.loadEnvFile()` and host env vars win.
- The API binds `127.0.0.1` by default (`HOST` overrides). Keep the Vite proxy on `127.0.0.1` to avoid IPv6/IPv4 mismatches.
- The eslint configs exist for mido's size/analysis gates, not for day-to-day linting; linting is oxlint.
