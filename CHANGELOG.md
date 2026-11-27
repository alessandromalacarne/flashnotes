# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-27

First public release. The project is in initial development (`0.y.z`), so the
public API may change between minor versions.

### Added

- **Notes and groups.** A note is valid only when it ends with at least one
  `@group` marker; markers are stripped from the stored body and linked to the
  group. Notes can be created, listed, filtered by group, edited and deleted.
- **Local-first storage.** Notes and groups live in a per-user SQLite database
  in the browser (SQLite WASM over OPFS). The app reads and writes locally and
  keeps the database across sign-out.
- **Guest workspace.** Visitors can write and browse notes in a local workspace
  without creating an account.
- **Demo account.** A shared, flagged demo identity entered from "Try demo",
  with a seeded note set and a reset control. Demo data stays local and is
  cleared when the demo is entered or left.
- **Accounts.** Sign-up, sign-in, sign-out and `GET /auth/me`, with cookie
  sessions (`HttpOnly`, `SameSite=Lax`, 3-day idle and 14-day absolute
  lifetimes).
- **Composer.** Shift+Enter sends, Enter inserts a newline; the shortcut is off
  on touch devices and clicking anywhere focuses the field.
- **Groups page.** Groups with note counts, most used first, plus a group page
  with an empty composer, inline editing and delete behind a confirm step.
- **Shared core.** `@flashnotes/core` owns the trailing-marker parser, note
  validation, error messages and limits used by both the API and the web app.
- **API.** Auth, notes and groups routes with `class-validator` DTOs and
  human-readable HTTP errors.
- **Operations.** Nginx site config, `scripts/pg.sh` for local PostgreSQL,
  `compose.yaml`, a Nix devShell, and CI that runs the mido guardrails ladder
  and `npm audit` for `api`, `core` and `web`.

### Fixed

- Editing a note keeps the groups it already belongs to; another trailing
  marker adds a group on top.
- Only a marker at the end of the note links a group: `#home`, `foo@bar.com`
  and a marker followed by punctuation stay plain text.
- The trailing-marker parser stays linear on adversarial notes.
- Emails are trimmed, NFC-normalized and lowercased before storage, preventing
  duplicate accounts from Unicode variants.

### Security

- Every notes and groups route requires a live session; `GET /auth/me` answers
  `200 { "user": null }` for anonymous callers.
- Public user reads select only `id`, `email` and `isDemo`, never the password
  hash.
- The session cookie is `Secure` and uses the `__Host-` prefix when
  `NODE_ENV=production`.
- Sign-up and sign-in are throttled per client, with a dedicated bucket for
  `POST /auth/demo` and a progressive per-account lockout after repeated
  password failures. The demo account cannot be used as a password account.

[Unreleased]: https://github.com/alessandromalacarne/flashnotes/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/alessandromalacarne/flashnotes/releases/tag/v0.1.0