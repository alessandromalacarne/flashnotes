# Contract: try the demo account
#
# Decisions taken at sign-off:
#   - One shared demo user, flagged isDemo. There are no per-visitor accounts and
#     no cleanup job: the demo identity is a single row created by a seed command.
#   - The only way in is POST /auth/demo, reached from the "Try demo" button.
#     Password sign-in with the demo identity is refused server-side, so the demo
#     is not a credential account even though it has a (never disclosed) hash.
#   - Demo notes are local-only. The web app never calls the notes/groups API for
#     them, and the seed command writes no notes or groups to PostgreSQL.
#   - Entering the demo always clears the demo's local database and re-seeds it,
#     and signing out of the demo removes that database. This is the one exception
#     to the "local database is kept across sign-out" decision of the local-first
#     contract: the demo identity is shared by every visitor of a browser profile,
#     so stale demo notes must never reach the next visitor.
#   - Demo mode is visible: a banner in the app shell and a reset control that
#     restores the seed set. isDemo is part of the User type exposed by /auth/me.
#   - The "Try demo" button appears on the landing page and on the login page.
#
# Assumptions (veto at review, then these become obligations):
#   - The demo address is demo@flashnotes.app.
#   - The sample set is 7 notes: @home (2), @work (2), @ideas (3).
#   - The seed command is `npm run db:seed` in api/ and is idempotent.
#   - POST /auth/demo gets a dedicated bucket of 20 requests per 60 s per client,
#     tunable with DEMO_THROTTLE_LIMIT and DEMO_THROTTLE_TTL_MS.
#   - A missing demo row answers 503 "Demo is not available" (the endpoint never
#     creates the account).
#   - Sign-in with the demo address answers 401 with "The demo account is
#     available from the Try demo button" — the demo is advertised publicly, so
#     the message leaks nothing; it is the hint for anyone typing the address.
#
# Non-goals (explicitly not obligations of this contract):
#   - Per-visitor demo users, demo-user expiry sweeps, or server-side demo data.
#   - Syncing demo notes to the API or across devices/browsers.
#   - Importing a real user's notes into the demo, or turning demo data into a
#     real account.
#   - Analytics on demo usage.
#   - Multi-tab behaviour: another tab signing out of the demo while this tab is
#     open is out of scope (the local-first contract already excludes live sync).
#   - Rate limiting by account or session id; the limit is per client.

Feature: Try the demo account
  An anonymous visitor can enter a shared demo account with one click and use
  flashnotes with a seeded set of notes. The demo is a real session over a real
  user row, but its notes live only in the visitor's browser and start from the
  sample set on every entry, so a shared browser never leaks one visitor's demo
  notes to the next one.

  Background:
    Given the API is reachable
    And the demo seed command has been run
    And the demo user exists with id "demo-user", email "demo@flashnotes.app" and isDemo true
    And the visitor has no active session

  # ---------------------------------------------------------------------------
  # Entry through the API
  # ---------------------------------------------------------------------------

  @functional
  Scenario: Entering the demo establishes a session for the demo user
    When the visitor posts to /auth/demo
    Then the response is 200 with the user {id: "demo-user", email: "demo@flashnotes.app", isDemo: true}
    And a session cookie is set
    And GET /auth/me returns that same demo user
    When the visitor posts to /auth/sign-out
    Then the response is 204
    And GET /auth/me returns {user: null}

  @functional
  Scenario: Two anonymous visitors reach the same demo user
    When two different anonymous clients each post to /auth/demo
    Then both responses carry the user id "demo-user"
    And each response is 200

  @functional @edge-case
  Scenario: A request body cannot select a different identity
    When the visitor posts to /auth/demo with body {email: "ana@example.com", password: "secret"}
    Then the response is 200 with the demo user
    And an account is not created for "ana@example.com"

  @functional @edge-case
  Scenario: A missing demo row is reported and creates nothing
    Given the demo user has been removed
    When the visitor posts to /auth/demo
    Then the response is 503 with "Demo is not available"
    And no session cookie is set
    And GET /auth/me returns {user: null}
    And no user is created

  @functional @edge-case
  Scenario: Demo entry does not depend on the server notes routes
    Given FLASHNOTES_SERVER_DB is "off"
    When the visitor posts to /auth/demo
    Then the response is 200 with the demo user
    When the visitor enters the demo from the landing page
    Then /app lists the sample set
    And no HTTP request is made to /api/notes or /api/groups

  # ---------------------------------------------------------------------------
  # The demo is not a credential account
  # ---------------------------------------------------------------------------

  @non-functional @security
  Scenario Outline: Password sign-in cannot open the demo
    When the visitor posts to /auth/sign-in with {email: "demo@flashnotes.app", password: "<password>"}
    Then the response is 401 with "The demo account is available from the Try demo button"
    And no session cookie is set
    And GET /auth/me returns {user: null}

    Examples:
      | password              |
      | correct horse battery |
      | demo                  |
      |                       |

  @non-functional @security
  Scenario: Sign-up cannot claim the demo address
    When the visitor posts to /auth/sign-up with {email: "demo@flashnotes.app", password: "correct horse battery"}
    Then the response is 409 with "Email already registered"
    And the demo user still exists with id "demo-user"

  @non-functional @security
  Scenario: The demo password hash is never exposed
    When the visitor posts to /auth/demo
    Then the response user object has exactly the keys id, email and isDemo
    And GET /auth/me returns a user object with exactly the keys id, email and isDemo

  @functional
  Scenario: Real accounts report isDemo false
    Given "ana@example.com" signed up as user "user-1"
    When ana requests /auth/me
    Then the response user is {id: "user-1", email: "ana@example.com", isDemo: false}

  @functional @edge-case
  Scenario: Failed demo sign-ins do not lock out other addresses
    Given 5 sign-in attempts were made with {email: "demo@flashnotes.app", password: "wrong"}
    And "ana@example.com" signed up as user "user-1"
    When ana posts to /auth/sign-in with her correct password
    Then the response is 200
    And ana has a session

  # ---------------------------------------------------------------------------
  # Provisioning
  # ---------------------------------------------------------------------------

  @functional
  Scenario: The seed command is idempotent
    When the operator runs the demo seed command twice
    And two anonymous clients each post to /auth/demo
    Then both responses carry the user id "demo-user"
    And the database contains exactly one user with isDemo true

  @functional
  Scenario: Seeding writes no notes or groups to the server
    Given the server notes and groups routes are enabled
    When the visitor enters the demo
    Then GET /notes returns an empty list
    And GET /groups returns an empty list

  # ---------------------------------------------------------------------------
  # Local demo data
  # ---------------------------------------------------------------------------

  @functional
  Scenario: Entering the demo seeds the sample set
    When the visitor enters the demo from the landing page
    Then /app lists 7 notes
    And the groups page lists "@ideas" with "3 notes", "@home" with "2 notes" and "@work" with "2 notes"
    And the @home group page lists "buy coffee" and "call the dentist"

  @functional
  Scenario: Reloading keeps the demo data instead of re-seeding it
    Given the visitor entered the demo
    And the visitor saved "my own thought @home"
    When the visitor reloads the page
    Then the @home group page lists "my own thought" and "buy coffee"
    And the page shows "3 notes" for @home
    And "buy coffee" appears once

  @functional
  Scenario: Signing out of the demo removes its local data
    Given the visitor entered the demo
    And the visitor saved "my own thought @home"
    When the visitor signs out
    And inspects the origin's OPFS storage
    Then no SQLite database exists for user "demo-user"
    When the visitor enters the demo again
    Then "my own thought" is absent
    And the @home group page lists "buy coffee" and "call the dentist"

  @functional @edge-case
  Scenario: Entry after an ended demo session still starts from the seed
    Given the visitor entered the demo
    And the visitor saved "my own thought @home"
    When the demo session cookie is deleted without a sign-out
    And the visitor reloads and enters the demo again
    Then "my own thought" is absent
    And the sample set is present

  @non-functional @security
  Scenario: The demo never touches a real account's local data
    Given "ana@example.com" saved "ana note @home" and signed out
    When the visitor enters the demo, saves "demo note @work" and signs out
    And "ana@example.com" signs in again
    Then ana sees "ana note" in @home
    And ana does not see "demo note"
    And no note named "ana note" is ever written to the demo database

  @non-functional @security
  Scenario: Demo writes stay local
    Given the visitor entered the demo
    When the visitor saves, edits and deletes notes
    And the visitor resets the demo
    Then no HTTP request is made to /api/notes, /api/notes/:id, /api/groups or /api/groups/:id
    And HTTP requests to /api/auth/demo, /api/auth/me and /api/auth/sign-out still happen

  @non-functional @reliability
  Scenario: Demo data survives a browser restart while the session lasts
    Given the visitor entered the demo and saved "my own thought @home"
    When the browser is closed and reopened with the demo session cookie intact
    Then the @home group page still lists "my own thought"
    And the demo banner is shown

  @non-functional @reliability
  Scenario: Unavailable local storage fails loudly and keeps the session
    Given the browser cannot open the local SQLite database
    When the visitor enters the demo
    Then the app shows an alert explaining that local storage is unavailable
    And the visitor is still signed in as the demo user

  # ---------------------------------------------------------------------------
  # Entry points and demo-mode UI
  # ---------------------------------------------------------------------------

  @functional
  Scenario: The landing page enters the demo with one click
    When the visitor activates "Try demo" on the landing page
    Then exactly one POST /api/auth/demo is sent
    And the visitor lands on /app
    And the sample set is listed

  @functional
  Scenario: The login page enters the demo and honours the return path
    Given the visitor was sent to /login from /app/groups
    When the visitor activates "Try demo" on the login page
    Then the visitor lands on /app/groups
    And the demo banner is shown

  @functional @edge-case
  Scenario: Repeated clicks do not create extra sessions
    Given the visitor activates "Try demo" on the landing page
    And the demo request is still in flight
    When the visitor activates the control again
    Then no second POST /api/auth/demo is sent
    And the control is disabled while the request is in flight

  @functional @edge-case
  Scenario Outline: A failed demo entry stays on the page
    Given the demo entry answers <status>
    When the visitor activates "Try demo" on the landing page
    Then the visitor stays on the landing page
    And an alert is shown
    And no session is established
    And no local demo database is opened

    Examples:
      | status |
      | 429    |
      | 500    |

  @functional @edge-case
  Scenario: A missing demo row is explained to the visitor
    Given the demo entry answers 503 with "Demo is not available"
    When the visitor activates "Try demo" on the landing page
    Then the alert reads "Demo is not available"
    And the visitor stays on the landing page

  @functional
  Scenario: The banner explains demo mode on every app route
    When the visitor enters the demo
    And the visitor opens /app
    And the visitor opens /app/groups
    And the visitor opens /app/group/home
    Then a banner named "Demo mode" is shown on each page
    And the banner states that notes stay in this browser and are removed on sign out
    And the banner offers a control named "Reset demo data"

  @functional
  Scenario: Real accounts see no demo banner
    Given "ana@example.com" signed in as user "user-1"
    When ana opens /app
    Then no banner named "Demo mode" is shown
    And no control named "Reset demo data" is shown

  @functional @edge-case
  Scenario: Signed-in visitors are not offered the demo
    Given the visitor entered the demo
    When the visitor opens the landing page
    Then no control named "Try demo" is shown

  @non-functional @accessibility
  Scenario: The demo controls are keyboard operable and named
    Given the visitor entered the demo
    When the visitor reaches the banner by keyboard
    Then the banner is announced as "Demo mode"
    And "Reset demo data" is reachable and activatable with Enter and Space
    And the reset confirmation is operable by keyboard

  # ---------------------------------------------------------------------------
  # Boundaries, safeguarding and performance
  # ---------------------------------------------------------------------------

  @non-functional @security
  Scenario: Only the demo route is public
    When an anonymous client requests /notes
    Then the response is 401
    And an anonymous client receives 401 on every route except /auth/sign-up, /auth/sign-in and /auth/demo

  @non-functional @security
  Scenario: A cross-origin demo request is rejected
    When an anonymous client posts to /auth/demo with a foreign Origin header
    Then the request is rejected with a 4xx response
    And no session cookie is set

  @non-functional @security
  Scenario: The demo session cookie matches a password sign-in cookie
    Given "ana@example.com" signed up as user "user-1"
    When the visitor posts to /auth/demo
    And a password sign-in is performed with ana's credentials
    Then the Set-Cookie attributes of both responses are identical
    And in production both cookies are Secure and HttpOnly

  @non-functional @security
  Scenario: The demo route is throttled per client
    Given the demo throttle is 20 requests per 60 seconds
    When one client posts to /auth/demo 20 times in the window
    Then all 20 responses are 200
    When the same client posts a 21st time in the window
    Then the response is 429
    And no session cookie is set

  @non-functional @performance
  Scenario: Demo entry responds without credential verification
    When one client posts to /auth/demo 20 times
    Then the 95th percentile response time is at most 200 ms

  @non-functional @performance
  Scenario: Entry plus seeding renders the sample set quickly
    When the visitor enters the demo from the landing page
    Then /app lists the sample notes within 1 s at p95 over 10 runs
