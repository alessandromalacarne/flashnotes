# Deploying flashnotes

This is the production runbook for this repository. It is version-agnostic:
replace the placeholders with the release and host values you are deploying.
It assumes a single Linux host with nginx and systemd. The repository does not
ship a Dockerfile for the app or a systemd unit; the unit below is a reference
you can adapt.

## 1. Topology

```text
browser
  │  HTTPS
  ▼
nginx :443
  ├── /            → static SPA files (web/dist)
  └── /api/        → http://127.0.0.1:3000/ (NestJS API)
                         │
                         ├── PostgreSQL 17   (accounts; notes/groups if enabled)
                         └── Redis 7         (sessions, optional)
```

The web app is local-first: each browser keeps its notes and groups in its own
SQLite database in OPFS. PostgreSQL stores accounts, and it stores notes and
groups only for clients that call the API directly. Do not expect a database
backup to contain a user's notes.

## 2. Placeholders

| Placeholder        | Meaning                             | Example                   |
| ------------------ | ----------------------------------- | ------------------------- |
| `<domain>`         | Public hostname                     | `flashnotes.app`          |
| `<version>`        | Release tag to deploy               | `v1.2.3`                  |
| `<app-dir>`        | Checkout on the server              | `/srv/flashnotes/app`     |
| `<web-root>`       | Directory nginx serves              | `/var/www/flashnotes`     |
| `<env-file>`       | API environment file                | `/etc/flashnotes/api.env` |
| `<service-user>`   | Unprivileged user that runs the app | `flashnotes`              |
| `<nginx-group>`    | Group the nginx worker runs as      | `www-data` or `nginx`     |
| `<db-name>`        | PostgreSQL database                 | `flashnotes`              |
| `<db-user>`        | PostgreSQL role                     | `flashnotes`              |
| `<db-password>`    | PostgreSQL password                 | a long random value       |
| `<redis-password>` | Redis password                      | a long random value       |

## 3. Prerequisites

- Linux host with `systemd` and `nginx`.
- Node.js 24 (`node -v` must report `v24.x`).
- PostgreSQL 17.
- Git.
- Optional: Redis 7 for shared sessions.
- A DNS record for `<domain>` and a TLS certificate.
- Ability to install dependencies from the npm registry (Prisma downloads its
  engines during installation; on NixOS set `PRISMA_SCHEMA_ENGINE_BINARY`).

The repository has no root `package.json`: `core/`, `api/` and `web/` each own
their lockfile and install step.

## 4. One-time host setup

### 4.1 Service user and directories

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin <service-user>
sudo mkdir -p <app-dir> <web-root> /etc/flashnotes /var/backups/flashnotes
sudo chown -R <service-user>:<service-user> <app-dir>
sudo chown -R <service-user>:<service-user> /var/backups/flashnotes
```

`<web-root>` must be readable by the nginx worker user (`www-data` on Debian
and Ubuntu, `nginx` on RHEL). The API environment file must not be readable by
other users (see §7).

### 4.2 PostgreSQL

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE <db-user> LOGIN PASSWORD '<db-password>';
CREATE DATABASE <db-name> OWNER <db-user>;
SQL
```

Keep PostgreSQL bound to loopback or a private network. Do not expose it on a
public interface.

### 4.3 Redis (optional)

Sessions are in memory when `REDIS_URL` is unset. Use Redis when you run more
than one API process or when restarts must not sign everyone out.

Edit `/etc/redis/redis.conf` (or the equivalent file for your distribution)
and set a strong password and a loopback bind. The file must contain exactly
one `requirepass` line; uncomment it or add it:

```ini
bind 127.0.0.1
requirepass <redis-password>
```

Then restart Redis:

```bash
sudo systemctl restart redis-server
```

Adjust the unit name if the distribution calls it `redis` instead of
`redis-server`.

The `compose.yaml` in the repository is a local-development convenience. It
publishes PostgreSQL and Redis on `127.0.0.1` and defaults to weak passwords;
do not use it unchanged on a public host.

### 4.4 nginx and TLS

```bash
sudo apt install nginx certbot python3-certbot-nginx   # Debian/Ubuntu
```

The repository's `nginx.conf` is HTTP-only. TLS is an operator step; see §10.

## 5. Fetch a release

Deploy a tag, never a dirty branch:

```bash
sudo -u <service-user> git clone https://github.com/alessandromalacarne/flashnotes.git <app-dir>
cd <app-dir>
sudo -u <service-user> git fetch --tags
sudo -u <service-user> git checkout <version>
```

If the checkout already exists, fetch and check out the tag instead of cloning
again. Verify the working tree is clean:

```bash
sudo -u <service-user> git status --short
```

## 6. Build the packages

Build in this order. `api` and `web` depend on the built `@flashnotes/core`
through `file:../core`, and the API resolves it at runtime too.

```bash
cd <app-dir>/core
sudo -u <service-user> npm ci
sudo -u <service-user> npm run build

cd <app-dir>/api
sudo -u <service-user> npm ci
sudo -u <service-user> npm run prisma:generate
sudo -u <service-user> npm run build

cd <app-dir>/web
sudo -u <service-user> npm ci
sudo -u <service-user> npm run build
```

What each step produces:

| Path                        | Contents                              |
| --------------------------- | ------------------------------------- |
| `core/dist/`                | Shared parser, validation and limits  |
| `api/src/generated/prisma/` | Prisma client (gitignored, generated) |
| `api/dist/`                 | Compiled API (`dist/main.js`)         |
| `web/dist/`                 | Static SPA build                      |

Notes:

- Use `npm ci`, not `npm install`, so the lockfiles are honored.
- `prisma:generate` is required after every install and after schema changes.
  Never edit `api/src/generated/prisma` by hand.
- If you build on another machine, preserve the layout: `core/` must sit next
  to `api/` and `web/`, with `core/dist/` built, or the `file:` dependency
  breaks.
- The API needs its production `node_modules` at runtime. Do not delete
  `api/node_modules` after the build. If you want a smaller runtime footprint,
  run `npm prune --omit=dev` in `api/` after building.

## 7. Configure the API

Create `<env-file>` owned by `<service-user>` with mode `0600`:

```bash
sudo install -m 600 -o <service-user> -g <service-user> /dev/null <env-file>
sudo -u <service-user> tee <env-file> >/dev/null <<'ENV'
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
DATABASE_URL=postgresql://<db-user>:<db-password>@127.0.0.1:5432/<db-name>
# REDIS_URL=redis://:<redis-password>@127.0.0.1:6379
# FLASHNOTES_SERVER_DB=off
# THROTTLE_LIMIT=120
# THROTTLE_TTL_MS=60000
# AUTH_THROTTLE_LIMIT=5
# AUTH_THROTTLE_TTL_MS=60000
# DEMO_THROTTLE_LIMIT=20
# DEMO_THROTTLE_TTL_MS=60000
ENV
```

Variable reference:

| Variable                                           | Required | Effect                                                                  |
| -------------------------------------------------- | -------- | ----------------------------------------------------------------------- |
| `NODE_ENV=production`                              | yes      | Makes the session cookie `Secure` and `__Host-` prefixed. HTTPS needed. |
| `PORT`                                             | no       | API port, default `3000`.                                               |
| `HOST`                                             | no       | Bind address, default `127.0.0.1`. Keep it on loopback behind nginx.    |
| `DATABASE_URL`                                     | yes      | PostgreSQL connection string, also read by the Prisma CLI.              |
| `REDIS_URL`                                        | no       | Enables the Redis session store. The API fails to start if unreachable. |
| `FLASHNOTES_SERVER_DB=off`                         | no       | Unmounts the server notes/groups routes (they answer 404); auth stays.  |
| `THROTTLE_*`, `AUTH_THROTTLE_*`, `DEMO_THROTTLE_*` | no       | Per-bucket rate limits (see `api/src/security/throttle.config.ts`).     |

`api/.env` is optional at runtime: `main.ts` loads it if it exists, and values
already in the environment win. Prefer the systemd `EnvironmentFile` shown
below so secrets do not live in the checkout.

URL-encode special characters in `<db-password>` and `<redis-password>` when
building the connection strings.

## 8. Migrate and seed

Run migrations before starting the new API version. Use `migrate deploy` in
production, never `migrate dev`.

```bash
sudo -u <service-user> bash -c '
  cd <app-dir>/api
  set -a
  . <env-file>
  set +a
  npm run db:deploy
'
```

Back up the database first if this is an existing deployment (§15).

The demo account is a shared user row seeded by an idempotent script:

```bash
sudo -u <service-user> bash -c '
  cd <app-dir>/api
  set -a
  . <env-file>
  set +a
  npm run db:seed
'
```

Run it when the "Try demo" button is enabled. Without the row, `POST
/api/auth/demo` answers `503` and the button fails. Demo notes are local to each
browser; the seed creates no notes or groups.

## 9. Publish the web app

```bash
sudo rsync -a --delete <app-dir>/web/dist/ <web-root>/
sudo chown -R <service-user>:<nginx-group> <web-root>
sudo find <web-root> -type d -exec chmod 755 {} +
sudo find <web-root> -type f -exec chmod 644 {} +
```

`--delete` removes stale hashed assets. The SPA is served from `/`; the web app
calls `/api/...` on the same origin, so do not move it under a subpath without
updating nginx and the Vite base.

## 10. Configure nginx

The repository's `nginx.conf` is a complete configuration: it contains `events`
and `http` blocks and includes `mime.types` from `/var/www/mime.types`. Choose
one of these approaches:

- Use it as the main `/etc/nginx/nginx.conf`, after pointing the `include` at
  the distribution's `mime.types` (usually `/etc/nginx/mime.types`).
- Or copy only the `server { ... }` block into
  `/etc/nginx/sites-available/<domain>` and symlink it into `sites-enabled/`.
  In that case the `include` line belongs in the main `http` block, not in the
  site file.

The repository file is a minimal main configuration. Using it as-is replaces
the distribution's `nginx.conf`, so you may lose its `user`, logging and module
settings. Prefer the site-block approach.

The equivalent production server block, with TLS:

```nginx
server {
    listen 80;
    server_name <domain>;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name <domain>;

    ssl_certificate     /etc/letsencrypt/live/<domain>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<domain>/privkey.pem;

    root <web-root>;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        # The trailing slash strips the /api prefix before proxying.
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Why these directives matter:

- `try_files ... /index.html` serves the SPA for client-side routes.
- `proxy_pass` with the trailing slash turns `/api/auth/me` into `/auth/me`.
- The API compares `Origin` and `Host` for CSRF protection. Keep the public
  hostname and the proxied `Host` consistent. If the site answers on both
  `example.com` and `www.example.com`, redirect one to the other or preserve
  the actual host with `Host $host`.
- `NODE_ENV=production` makes the session cookie `Secure`, so the browser must
  see HTTPS. Terminate TLS at nginx or at the load balancer in front of it.
- Ensure the active `mime.types` maps `.wasm` to `application/wasm`; the local
  SQLite engine is a WASM asset.
- Do not put the API on a different origin. The web app, cookies and CSRF
  protection assume same-origin `/api`.

Validate and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 11. Run the API

Reference unit at `/etc/systemd/system/flashnotes-api.service`:

```ini
[Unit]
Description=flashnotes API
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=<service-user>
Group=<service-user>
WorkingDirectory=<app-dir>/api
EnvironmentFile=<env-file>
ExecStart=/usr/bin/node dist/main
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Adjust `ExecStart` to the Node 24 binary (`command -v node`). If PostgreSQL is
remote, drop the `postgresql.service` dependency or replace it with the unit
that actually exists on the host.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now flashnotes-api
sudo systemctl status flashnotes-api
```

The API binds `127.0.0.1:3000` by default; nginx is the only public entry
point.

## 12. Verify the deployment

Run these checks after every deploy:

```bash
# API directly (bypasses nginx)
curl -fsS http://127.0.0.1:3000/auth/me
# → {"user":null}

# Through nginx
curl -fsS https://<domain>/api/auth/me
curl -fsSI https://<domain>/
# → 200 and text/html

# Database reachable
psql "<database-url>" -c 'select 1'

# Service logs
sudo journalctl -u flashnotes-api -n 100 --no-pager
```

Then, in a browser:

1. Load `https://<domain>/` and sign up or sign in.
2. Inspect the session cookie: it must be `Secure`, `HttpOnly`, `SameSite=Lax`
   and carry the `__Host-` prefix.
3. Create a note, reload the page and confirm it is still there. Notes live in
   the browser (OPFS); the server does not store them.
4. If the demo is enabled, click "Try demo" and confirm the seed data appears.
5. Delete the demo or sign out and confirm the session ends.

## 13. Update an existing deployment

1. Pick the next SemVer tag; deploy only a tag whose pull request checks are
   green.
2. Back up the database (§15).
3. Fetch and check out the tag (§5).
4. Build `core`, `api` and `web` (§6).
5. Run `npm run db:deploy` and, if needed, `npm run db:seed` (§8).
6. Publish the new `web/dist` (§9).
7. Restart the API: `sudo systemctl restart flashnotes-api`.
8. Reload nginx only if its configuration changed.
9. Run the checks in §12.

Keep the previous tag, its `web/dist` and the pre-deploy database dump until
the new release is verified.

### Zero-downtime (optional)

The repository does not include a zero-downtime setup. If you need one, run two
API instances on different ports behind an nginx `upstream`, switch traffic
after the new instance is healthy, and write migrations so the old and new code
can run against the same schema (expand/contract). Without that discipline,
deploy during a maintenance window.

## 14. Roll back

1. Stop the API: `sudo systemctl stop flashnotes-api`.
2. Check out the previous tag and rebuild `core`, `api` and `web`.
3. Publish the previous `web/dist`.
4. If the failed release applied a migration that the previous code cannot
   read, restore the pre-deploy dump:

   ```bash
   pg_restore --clean --if-exists --no-owner --no-acl \
     --dbname="<database-url>" /var/backups/flashnotes/<dump-file>
   ```

5. Start the API and run the checks in §12.

Prisma migrations are forward-only. Never edit a migration that has already
been applied; add a new migration instead.

## 15. Backups

Back up PostgreSQL before every deploy:

```bash
pg_dump --format=custom --no-owner --no-acl \
  --file=/var/backups/flashnotes/flashnotes-$(date +%F-%H%M).dump \
  "<database-url>"
```

- Restrict `/var/backups/flashnotes` to the service user and root.
- Test a restore on a scratch database periodically.
- Redis stores sessions only; losing it signs users out, it does not lose notes.
- Users' notes live in browser OPFS. They are not in PostgreSQL and cannot be
  backed up from the server. Clearing site data deletes them.

## 16. Security checklist

- [ ] TLS is enforced; HTTP redirects to HTTPS.
- [ ] `NODE_ENV=production` is set and the session cookie is `Secure` and
      `__Host-` prefixed.
- [ ] `<env-file>` is mode `0600`, owned by `<service-user>`; no secrets in git.
- [ ] PostgreSQL and Redis listen on loopback or a private network only.
- [ ] The API listens on `127.0.0.1:3000`; only nginx is public.
- [ ] The service runs as an unprivileged user.
- [ ] Database backups are restricted and tested.
- [ ] Dependency updates pass CI (`npm audit` and the mido ladder).
- [ ] The demo account is seeded only when the demo is intended to be public.
- [ ] Rate limits are tuned; see the proxy caveat in §17.

## 17. Troubleshooting and known limitations

| Symptom                                                | Likely cause and fix                                                                                                                                                                                                              |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `502 Bad Gateway` from nginx                           | The API is not running or not listening on `127.0.0.1:3000`. Check `systemctl status flashnotes-api` and `ss -ltnp \| grep 3000`.                                                                                                 |
| Sign-in returns `200` but the session is not kept      | `NODE_ENV=production` with plain HTTP: the `Secure` cookie is dropped. Serve HTTPS.                                                                                                                                               |
| `403` on `POST`/`PATCH`/`DELETE`                       | CSRF check failed: the browser `Origin` does not match the proxied `Host`. Use one canonical hostname and `proxy_set_header Host $host`.                                                                                          |
| `Cannot find module '@flashnotes/core'` or type errors | `core` was not built before `api`/`web`. Run `npm ci && npm run build` in `core/` first.                                                                                                                                          |
| Prisma engine download or `schema-engine` errors       | Node version is wrong, the network blocks the download, or the host is NixOS. Set `PRISMA_SCHEMA_ENGINE_BINARY`.                                                                                                                  |
| `prisma migrate deploy` fails                          | `DATABASE_URL` is missing or wrong, the database is unreachable, or the migration history is inconsistent. Never run `migrate dev` in production.                                                                                 |
| "Try demo" returns `503`                               | Run `npm run db:seed` in `api/` with the production `DATABASE_URL`.                                                                                                                                                               |
| Notes disappear after a browser restart                | OPFS is unavailable (private mode, quota, unsupported browser) or site data was cleared. The server has no copy.                                                                                                                  |
| A second tab may fail to open the notes database       | The OPFS SAH pool allows one open instance per user ID per origin. Multi-tab use is out of scope; close the other tab and reload.                                                                                                 |
| Everyone is signed out after a restart                 | No `REDIS_URL`; the default session store is in memory. Configure Redis to keep sessions across restarts.                                                                                                                         |
| Rate limits hit too early for everyone                 | The API does not enable Express `trust proxy`, so behind nginx every request appears to come from `127.0.0.1` and the per-client buckets behave globally. Enable `trust proxy` in the API (a code change) or rate-limit at nginx. |

Known limitations of this deployment:

- One API process; a restart drops in-flight requests unless you build the
  zero-downtime setup described in §13.
- The API does not enable shutdown hooks; SIGTERM stops it without draining
  in-flight requests. Use a maintenance window or add graceful shutdown.
- The repository's nginx configuration is HTTP-only; TLS is not included.
- The repository has no Dockerfile, systemd unit or release workflow for the
  app; the unit above is a reference.
- The API's `npm run deploy` script is not used by this runbook; the service
  runs `node dist/main`.

## 18. Versioning

- Releases follow [Semantic Versioning](https://semver.org/) and are tagged
  `v<major>.<minor>.<patch>`.
- The project is in initial development (`0.y.z`); minor versions may include
  breaking changes.
- `CHANGELOG.md` is the source of release notes.
- Deploy only tagged commits, and keep the previous tag available for rollback.
