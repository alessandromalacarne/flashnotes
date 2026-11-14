# Contract: local-first notes and groups in the browser
#
# Decisions taken at sign-off:
#   - Authentication stays server-side. Only note and group CRUD moves to the
#     local database; sign-up, sign-in, sign-out and /auth/me keep using the API.
#   - No import of existing PostgreSQL data. The local database starts empty and
#     old server rows stay untouched.
#   - The local database is partitioned per userId and is kept across sign-out.
#   - Durability across reload and browser restart (OPFS). Multi-tab live sync
#     is out of scope (last write wins).
#
# Non-goals (explicitly not obligations of this contract):
#   - Syncing local data back to the API or across devices.
#   - Importing notes and groups already stored in PostgreSQL.
#   - Live updates between two open tabs.
#   - Encrypting the local database at rest.
#   - A cold start with no network: a browser that has never validated a session
#     still redirects to /login, because authentication remains server-side.

Feature: Local-first notes and groups
  Notes and groups belong to the signed-in user and live in a SQLite database
  in the browser. Every create, update and delete is written locally, and the
  UI reads from the local database. The API keeps its authentication endpoints
  and its existing notes/groups code, but the web app no longer calls the
  notes/groups CRUD routes.

  Background:
    Given the API is reachable
    And "ana@example.com" is signed in as user "user-1" with a valid API session

  # ---------------------------------------------------------------------------
  # Create
  # ---------------------------------------------------------------------------

  @functional
  Scenario: Creating a note writes it to the local database
    Given the local database for user "user-1" has no notes or groups
    When the user saves the note "buy coffee @home" from the composer
    Then the note is stored locally with content "buy coffee"
    And the note is linked to the group "home"
    And the @home group page lists "buy coffee" at the top without a page reload
    And the groups page lists "@home" with "1 note"
    And no HTTP request is made to any /api/notes or /api/groups route

  @functional
  Scenario Outline: Only trailing markers become groups
    Given the local database for user "user-1" has no notes or groups
    When the user saves the note "<raw>"
    Then the stored content is "<content>"
    And the note is linked to exactly the groups {<groups>}

    Examples:
      | raw                       | content    | groups      |
      | buy coffee @home          | buy coffee | home        |
      | buy coffee @home @work    | buy coffee | home, work  |
      | buy coffee @HOME @home    | buy coffee | home        |
      | buy coffee @café          | buy coffee | café        |
      | buy coffee @work @home    | buy coffee | home, work  |

  @functional @edge-case
  Scenario: Markers on separate trailing lines still become groups
    Given the local database for user "user-1" has no notes or groups
    When the user saves a note whose text is "buy coffee" followed by "@home" and "@work" on their own lines
    Then the stored content is "buy coffee"
    And the note is linked to exactly the groups {home, work}

  @functional
  Scenario Outline: Invalid notes are rejected and nothing is written
    Given the local database for user "user-1" has no notes or groups
    When the user saves the note "<raw>"
    Then the save is rejected with "<message>"
    And no note is written to the local database
    And the composer keeps the draft "<raw>"

    Examples:
      | raw                      | message                                 |
      | buy coffee               | Include at least one @group in the note |
      | @home buy coffee         | Include at least one @group in the note |
      | buy coffee @home now     | Include at least one @group in the note |
      | buy coffee @home, please | Include at least one @group in the note |
      | @home                    | The note needs text besides the @group  |

  @functional @edge-case
  Scenario: A note may reference at most 32 groups
    Given the local database for user "user-1" has no notes or groups
    When the user saves a note that ends with 33 distinct group markers
    Then the save is rejected with "A note can reference at most 32 groups"
    And no note and no group is written to the local database

  @functional @edge-case
  Scenario: A note with exactly 32 groups is accepted
    Given the local database for user "user-1" has no notes or groups
    When the user saves a note that ends with 32 distinct group markers
    Then the note is stored with 32 group links

  @functional @edge-case
  Scenario: Group names are capped at 72 characters
    Given the local database for user "user-1" has no notes or groups
    When the user saves a note ending with a 73-character group marker
    Then the save is rejected with "Group names can have at most 72 characters"
    And no note and no group is written to the local database

  @functional @edge-case
  Scenario: A 72-character group name is accepted
    Given the local database for user "user-1" has no notes or groups
    When the user saves a note ending with a 72-character group marker
    Then the note is stored and linked to that group

  @functional @edge-case
  Scenario: Note content is capped at 10,000 characters on create and update
    Given the local database for user "user-1" has a note "buy coffee" in group "home"
    When the user saves a note with raw content over 10,000 characters that ends with "@home"
    Then the save is rejected with a message stating the 10,000-character limit
    And no note is written
    When the user edits the existing note to raw content over 10,000 characters that ends with "@home"
    Then the update is rejected with a message stating the 10,000-character limit
    And the stored note still reads "buy coffee" in group "home"

  # ---------------------------------------------------------------------------
  # Read
  # ---------------------------------------------------------------------------

  @functional
  Scenario: A group page lists only that group's notes, newest first
    Given the local database for user "user-1" has these notes:
      | content | groups     | createdAt            |
      | older   | home       | 2026-01-01T10:00:00Z |
      | newer   | home       | 2026-01-02T10:00:00Z |
      | other   | work       | 2026-01-03T10:00:00Z |
    When the user opens /app/group/home
    Then the page lists "newer" and then "older"
    And the page does not list "other"
    And the page shows "2 notes"

  @functional @edge-case
  Scenario: Group matching in the URL ignores case
    Given the local database for user "user-1" has a note "buy coffee" in group "home"
    When the user opens /app/group/Home
    Then the page lists "buy coffee"

  @functional
  Scenario: A note with several groups appears on each group page
    Given the local database for user "user-1" has a note "shared" in groups "home" and "work"
    When the user opens /app/group/home
    Then the page lists "shared" and shows "1 note"
    When the user opens /app/group/work
    Then the page lists "shared" and shows "1 note"

  @functional
  Scenario: The groups page orders by note count, then by name
    Given the local database for user "user-1" has 3 notes in group "home", 1 note in group "work" and 1 note in group "blog"
    When the user opens /app/groups
    Then the groups are listed as "@home" with "3 notes", then "@blog" with "1 note", then "@work" with "1 note"

  @functional @edge-case
  Scenario: Notes created in the same millisecond are ordered by id descending
    Given the local database for user "user-1" has two notes in group "home" with the same createdAt and ids "note-a" and "note-z"
    When the user opens /app/group/home
    Then "note-z" is listed before "note-a"

  @functional @edge-case
  Scenario: Empty states are preserved
    Given the local database for user "user-1" has no notes or groups
    When the user opens /app/groups
    Then the page shows "No groups yet." with a link to "/app"
    When the user opens /app/group/home
    Then the page shows "No notes with @home yet." with a link to "/app"

  # ---------------------------------------------------------------------------
  # Update
  # ---------------------------------------------------------------------------

  @functional
  Scenario: Updating a note rewrites its content and groups locally
    Given the local database for user "user-1" has a note "buy coffee" in group "home"
    When the user edits that note to "buy tea @work"
    Then the note is stored with content "buy tea"
    And the note is linked to exactly the groups {work}
    And the note no longer appears on the @home group page
    And "@home" no longer appears on the groups page
    And the note keeps its original createdAt
    And no HTTP request is made to any /api/notes or /api/groups route

  @functional
  Scenario: Editing a note can add a new group
    Given the local database for user "user-1" has a note "buy coffee" in group "home"
    When the user edits that note to "buy tea @home @work"
    Then the note is linked to exactly the groups {home, work}
    And the groups page lists "@work" with "1 note"

  @functional
  Scenario: Editing a note updates the group counts
    Given the local database for user "user-1" has 2 notes in group "home"
    When the user edits one of them to "moved @work"
    Then the groups page lists "@home" with "1 note" and "@work" with "1 note"

  @functional @edge-case
  Scenario: An update that leaves no group is rejected and keeps the note intact
    Given the local database for user "user-1" has a note "buy coffee" in group "home"
    When the user edits that note to "buy tea" with no trailing marker
    Then the update is rejected with "Include at least one @group in the note"
    And the stored note still reads "buy coffee" in group "home"
    And the editor keeps the draft "buy tea"

  # ---------------------------------------------------------------------------
  # Delete
  # ---------------------------------------------------------------------------

  @functional
  Scenario: Deleting a note removes it locally
    Given the local database for user "user-1" has a note "buy coffee" in group "home" and a note "keep" in group "work"
    When the user confirms deleting "buy coffee"
    Then "buy coffee" no longer appears on the @home group page
    And "@home" no longer appears on the groups page
    And "keep" still appears on the @work group page
    And no HTTP request is made to any /api/notes or /api/groups route

  @functional
  Scenario: Deleting a group keeps its notes
    Given the local database for user "user-1" has a note "buy coffee" in groups "home" and "work"
    When the user deletes the group "@home" from the groups page
    Then "@home" no longer appears on the groups page
    And "buy coffee" still appears on the @work group page
    And no note is deleted
    And no HTTP request is made to any /api/notes or /api/groups route

  @functional @edge-case
  Scenario Outline: Unknown ids are reported without writing
    Given the local database for user "user-1" has a note "buy coffee" in group "home"
    When the user runs the local operation "<operation>"
    Then it is rejected with "<message>"
    And the local database still contains exactly the note "buy coffee" in group "home"

    Examples:
      | operation                    | message         |
      | update note "missing-note"   | Note not found  |
      | delete note "missing-note"   | Note not found  |
      | delete group "missing-group" | Group not found |

  # ---------------------------------------------------------------------------
  # Persistence and isolation
  # ---------------------------------------------------------------------------

  @non-functional @reliability
  Scenario: Notes survive a page reload
    Given the local database for user "user-1" has a note "buy coffee" in group "home"
    When the user reloads the page
    Then the @home group page still lists "buy coffee"
    And the note keeps its id, content, groups and createdAt

  @non-functional @reliability
  Scenario: Notes survive closing and reopening the browser
    Given the local database for user "user-1" has a note "buy coffee" in group "home"
    When the browser is closed and reopened and the user signs in again
    Then the @home group page still lists "buy coffee"
    And the note keeps its id, content, groups and createdAt

  @non-functional @security
  Scenario: Local data is partitioned per user and kept across sign-out
    Given "ana@example.com" saved "ana note @home"
    When "ana@example.com" signs out and "bia@example.com" signs in as user "user-2"
    Then bia sees no notes and no groups
    When bia saves "bia note @work" and signs out
    And "ana@example.com" signs in again
    Then ana sees "ana note" in @home and does not see "bia note"
    When "bia@example.com" signs in again
    Then bia sees "bia note" in @work and does not see "ana note"

  @non-functional @security @edge-case
  Scenario: A note id from another user is treated as not found
    Given "ana@example.com" has a note "ana note" in group "home" with id "note-1"
    When "bia@example.com" signs in and tries to update note "note-1" to "stolen @work"
    Then the update is rejected with "Note not found"
    And ana's note still reads "ana note" in group "home"

  @non-functional @reliability
  Scenario: Note and group CRUD works while the API is unreachable
    Given the local database for user "user-1" is open and the API becomes unreachable
    When the user creates a note, lists a group, edits the note and deletes it
    And the user lists groups and deletes a group
    Then every operation succeeds
    And no network error is shown to the user

  @non-functional @reliability
  Scenario: A browser without OPFS or WASM SQLite support fails loudly
    Given the browser cannot open the local SQLite database
    When the user saves the note "buy coffee @home"
    Then the composer shows an alert explaining that local storage is unavailable
    And the composer keeps the draft "buy coffee @home"
    And the composer does not show "note saved"

  @non-functional @reliability
  Scenario: A failed local write is atomic
    Given the local database for user "user-1" has a note "buy coffee" in group "home"
    When the local database rejects the write with a quota error
    And the user edits that note to "buy tea @work"
    Then the card shows an alert with the storage error
    And the stored note still reads "buy coffee" in group "home"
    And the editor keeps the draft "buy tea @work"

  @non-functional @architecture
  Scenario: The local store is a SQLite database persisted in OPFS
    Given the local database for user "user-1" has a note "buy coffee" in group "home"
    When the user inspects the origin's OPFS storage
    Then a SQLite database file exists for user "user-1"
    And it holds the notes, groups and note-group relations
    And reopening the app reads the same note without any /api/notes request

  # ---------------------------------------------------------------------------
  # Performance
  # ---------------------------------------------------------------------------

  @non-functional @performance
  Scenario: Note and group operations stay responsive with 1,000 notes
    Given the local database for user "user-1" has 1,000 notes in group "home"
    When the user opens /app/group/home
    Then the first render lists the notes within 200 ms at p95 over 20 runs
    When the user creates, edits and deletes a note
    Then each write completes within 100 ms at p95 over 20 runs

  @non-functional @performance
  Scenario: Cold start initializes the local database within 2 seconds
    Given the local database for user "user-1" already contains 1,000 notes
    When the user opens the app
    Then the local database is ready within 2 seconds

  # ---------------------------------------------------------------------------
  # Boundaries with the server
  # ---------------------------------------------------------------------------

  @non-functional @security
  Scenario: The web app no longer calls the note and group CRUD endpoints
    Given the user performs create, list, update and delete on notes
    And the user performs list and delete on groups
    Then no HTTP request is made to /api/notes, /api/notes/:id, /api/groups or /api/groups/:id
    And HTTP requests to /api/auth/sign-up, /api/auth/sign-in, /api/auth/sign-out and /api/auth/me still happen

  @non-functional @compatibility
  Scenario: The API is untouched and keeps its contract
    Given the change is applied
    Then git shows no modified, added or deleted files under api/
    And the API unit and e2e suites still pass
    And POST /notes, GET /notes, PATCH /notes/:id, DELETE /notes/:id, GET /groups and DELETE /groups/:id keep their status codes and error messages
