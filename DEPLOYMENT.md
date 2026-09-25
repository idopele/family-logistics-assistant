# Private MVP Deployment

This project is ready to deploy as a private frontend MVP on Cloudflare Pages with temporary shared-family password protection provided by Cloudflare Pages Functions.

## Privacy Requirement

THIS DEPLOYMENT MUST BE PROTECTED BY THE CLOUDFLARE PAGES FUNCTION PASSWORD GATE BEFORE THE URL IS SHARED WITH FAMILY MEMBERS.

The app contains real family schedule data bundled into the frontend. Do not share the Cloudflare Pages URL until Access protection is configured and verified.

Do not add a fake password screen inside the React app for this MVP. Temporary private access is handled server-side by Cloudflare Pages Functions before static assets are returned.

## Current App Shape

- Framework: Vite / React
- Language: TypeScript
- Package manager: npm
- Backend required: Cloudflare Pages Functions only
- Database required: Cloudflare D1
- Runtime secrets required: yes, for temporary HTTP Basic Authentication
- D1 binding required: yes, `FAMILY_DB`
- Push infrastructure required: Cloudflare Worker with Cron Trigger and Web Push VAPID secrets
- Production output directory: `dist`
- Client-side deep links: supported with `?eventId=...&date=YYYY-MM-DD` for resolved schedule occurrences

Because the app currently renders from the root URL and does not use React Router or other deep-link routing, no Cloudflare Pages SPA fallback file is required for this step. Browser refresh on the main application URL should serve `index.html` normally.

## Cloudflare Pages Build Configuration

Use these settings when creating the Pages project:

| Setting | Value |
| --- | --- |
| Framework preset | Vite / React |
| Root directory | Project root |
| Install command | `npm install` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | `20.19.0` or newer, or `22.12.0` or newer |

Vite 7 requires Node `^20.19.0 || >=22.12.0`.

## Temporary Family Password Protection

The entire Cloudflare Pages application is protected by `functions/_middleware.ts`.

The middleware uses HTTP Basic Authentication and runs before the static React app and its assets are served. Requests without valid credentials receive `401 Unauthorized`. If the password gate is not configured, the middleware fails closed with `503 Service Unavailable` instead of exposing the site.

Configure these values manually in the Cloudflare Pages project as encrypted Secrets:

- `FAMILY_AUTH_USERNAME`
- `FAMILY_AUTH_PASSWORD`

In Cloudflare:

1. Open the Cloudflare Pages project.
2. Go to Settings.
3. Go to Variables and Secrets.
4. Create both values as encrypted Secrets.
5. Redeploy the Pages project so the Function receives the secrets.

Do not commit the actual username or password to Git, README, DEPLOYMENT.md, `.env`, Vite environment variables, or React source files.

This is temporary shared-password protection for the private family MVP. It will later be replaced by proper family authentication.

## Cloudflare D1 Shared Family Data

Mutable family data is stored in Cloudflare D1 through Cloudflare Pages Functions. The browser never talks to D1 directly; React only calls same-origin `/api/shared`.

Required D1 binding name:

- `FAMILY_DB`

Database migration file:

- `migrations/0001_shared_family_data.sql`
- `migrations/0002_event_reminders.sql`
- `migrations/0003_push_notifications.sql`
- `migrations/0004_authentication_members.sql`
- `migrations/0005_permission_shared_views.sql`
- `migrations/0006_calendar_sources.sql`

The migration creates:

- `custom_children`
- `custom_events`
- `event_exceptions`
- `transportation_plans`
- `event_reminders`
- `push_subscriptions`
- `notification_deliveries`
- `workspaces`
- `app_users`
- `workspace_memberships`
- `auth_sessions`
- `auth_invites`
- `user_schedule_member_links`
- `shared_views`
- `shared_view_users`
- `shared_view_schedule_members`
- `shared_view_categories`
- `shared_view_permissions`
- `app_meta`

The existing Basic Auth middleware protects both the frontend and `/api/*` requests. Do not create unauthenticated API routes.

Manual Cloudflare setup:

1. Create a Cloudflare D1 database for the family dashboard.
2. Apply `migrations/0001_shared_family_data.sql` to that D1 database.
3. Apply `migrations/0002_event_reminders.sql` to the same D1 database.
4. Apply `migrations/0003_push_notifications.sql` to the same D1 database.
5. In the Cloudflare Pages project, add a D1 binding named `FAMILY_DB`.
6. Confirm `FAMILY_AUTH_USERNAME` and `FAMILY_AUTH_PASSWORD` are still configured as encrypted Secrets.
7. Redeploy the Pages project.
8. Open the deployed site in an Incognito/private browser and verify Basic Auth appears before the app or any `/api/*` request is served.
9. Confirm custom children, custom events, occurrence changes, transportation plans, and event reminders sync between two browsers/devices after refresh or focus.

Do not document database IDs, API tokens, passwords, or secret values in the repository.
Reminder migration can be applied from the Cloudflare dashboard: open the D1 database, go to Console, paste the SQL from `migrations/0002_event_reminders.sql`, and run it against the existing family database. Do not paste or document credentials while applying migrations.

Push notification migration can also be applied from the Cloudflare dashboard: open the D1 database, go to Console, paste the SQL from `migrations/0003_push_notifications.sql`, and run it against `family-logistics-db`.

Authentication migration can be applied from the Cloudflare dashboard: open D1 -> `family-logistics-db` -> Console, paste the SQL from `migrations/0004_authentication_members.sql`, and run it once. This migration is additive and must not drop existing schedule, transportation, reminder, push subscription, or delivery tables. Apply migration `0004` exactly once: its `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` statements are rerunnable, but SQLite/D1 `ALTER TABLE ... ADD COLUMN` does not have the same rerunnable behavior.

Permission migration can be applied from the Cloudflare dashboard: open D1 -> `family-logistics-db` -> Console, paste the SQL from `migrations/0005_permission_shared_views.sql`, and run it once. This migration is additive and creates the normalized Shared View tables used for restricted access.

## Application Authentication

Step 13 adds in-app authentication while keeping the existing HTTP Basic Auth middleware as an outer temporary safety layer. Basic Auth still uses `FAMILY_AUTH_USERNAME` and `FAMILY_AUTH_PASSWORD` and must not be removed until the Step 13.1/14 cutover is verified.

Architecture:

- `workspaces` introduces a future-ready workspace foundation. The app operates in single-workspace mode using `default-family-workspace` with type `family`.
- `app_users` stores login accounts. A login account is separate from a schedule member/child such as Daniel or Emanuel.
- `workspace_memberships` stores coarse roles: `owner`, `admin`, `member`, and `viewer`.
- `user_schedule_member_links` optionally connects an app user to an existing schedule member id without requiring the schedule member to exist in D1.
- `auth_sessions` stores server-side sessions. The browser receives an HttpOnly cookie; D1 stores only a hash of the raw session token.
- `auth_invites` stores one-time invite records. D1 stores only a hash of the invite token.

Password hashing:

- Algorithm: PBKDF2 with SHA-256 through Web Crypto.
- Format: `pbkdf2-sha256-v1$<iterations>$<salt>$<hash>`.
- Iterations: `100000`.
- Salt: 16 cryptographically random bytes.
- Hash length: 32 bytes.
- Password policy: 10 to 256 characters. Spaces and symbols are allowed for password managers.

Cloudflare Workers/Pages native Web Crypto PBKDF2 is capped at 100000 iterations. Stored password hashes are versioned and include their own iteration count, so verification reads the serialized count instead of assuming the current creation setting. This is an edge-runtime constraint; before the Logistics Assistant Platform expands into a broad public or multi-tenant launch, authentication should evaluate migration to a stronger Cloudflare-compatible password KDF or a managed identity system.

Session policy:

- Lifetime: 30 days maximum.
- Logout revokes the current server-side session and expires the browser cookie.
- Disabled users cannot log in and existing sessions stop authorizing requests.
- Production cookie: `__Host-family_session`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`.
- Local development fallback cookie: `family_session`, `HttpOnly`, `SameSite=Lax`, `Path=/`.

Bootstrap:

1. Configure `AUTH_BOOTSTRAP_TOKEN` as a Cloudflare Pages encrypted Secret.
2. Deploy the app and open it after Basic Auth.
3. If there are zero app users/owners, the frontend shows initial setup.
4. Enter display name, email, password, and the bootstrap token.
5. The server creates the default workspace if needed, creates the first owner account, creates owner membership, and signs in with an HttpOnly session cookie.
6. Once any app user or owner exists, bootstrap refuses normal use.

Invites:

- Owner/admin can create invite links manually in App Info -> Manage users.
- Normal invites can create `admin`, `member`, or `viewer` accounts. They cannot create another `owner`.
- Invite lifetime: 7 days.
- Invite links contain the raw one-time token in `?invite=<token>`.
- The database stores only the token hash.
- Used, expired, or revoked invites fail safely.
- Email delivery is not included yet; copy the invite URL manually and send it outside the app.

API authorization:

- Existing schedule API `/api/shared` requires a valid app session.
- Push API `/api/push` requires a valid app session for public key lookup, subscription management, and test sends.
- Unsafe mutations validate JSON content type and same-origin `Origin` when present.
- React UI hiding is not trusted as authorization.

Push/account association:

- `push_subscriptions.user_id` is nullable.
- Existing subscriptions with `NULL` user id remain valid and continue receiving family-wide reminders.
- When an authenticated browser registers or refreshes a push subscription, the row is associated with that user for future targeted notification work.
- The current scheduler remains family-wide and unchanged.

Deep links:

- Existing `?eventId=<eventId>&date=YYYY-MM-DD` links are preserved.
- If the session is valid, the dashboard opens the exact occurrence.
- If the session expired, the Login screen appears first; after successful login, the original event/date query remains and the occurrence opens.
- Invite links use `?invite=<token>` and remove only the invite parameter after successful acceptance.

Important limitation:

External sharing should be production-validated with Step 14 Shared Views before family data is exposed to invited restricted accounts.

## Permission Engine and Shared Views

Step 14 adds server-enforced, default-deny authorization for non-owner/non-admin accounts. Owner and admin accounts retain full operational workspace access. Member and viewer accounts receive no schedule data until an owner/admin assigns them to an active Shared View.

Permission scopes:

- `view_schedule`
- `edit_schedule`
- `view_transportation`
- `edit_transportation`
- `view_contacts`
- `receive_notifications`
- `manage_users`, role-level owner/admin only
- `manage_shared_views`, role-level owner/admin only

Shared View model:

- `shared_views`: workspace, name, optional description, active flag, explicit `all_schedule_members`, explicit `all_categories`, creator, timestamps.
- `shared_view_users`: users assigned to each Shared View.
- `shared_view_schedule_members`: allowed seed or custom schedule member ids such as `daniel` and `emanuel`.
- `shared_view_categories`: allowed `EventCategory` values.
- `shared_view_permissions`: allowed non-management permission scopes.

Effective restricted access is the union of all active Shared Views assigned to the user. An event is visible only when the user has `view_schedule` and both the schedule member and category match the effective scope, unless the Shared View explicitly grants all members or all categories.

Server filtering:

- `/api/shared` computes authorization from D1 on each refresh.
- Owner/admin receive the full current response.
- Restricted users receive only authorized custom children, custom events, event exceptions, transportation plans, and event reminders.
- Transportation requires `view_transportation` and is limited to already-visible events.
- Reminder data requires `receive_notifications` and is limited to already-visible events.
- Mutations are checked server-side. `edit_schedule` is required for event/exception changes inside scope; `edit_transportation` is required for transportation changes inside scope; `receive_notifications` is required for reminder changes inside scope.

Seed-data authorization:

The bundled Daniel/Emanuel seed schedules still exist in the frontend bundle, but the dashboard now applies the server-provided authorization context before seed events are merged into occurrences, filters, counts, deep links, transportation summaries, or Today in the Family. Hidden seed events are not rendered or included in UI aggregates.

Deep-link authorization:

Existing `?eventId=<eventId>&date=YYYY-MM-DD` links remain supported. If a restricted user opens a link outside their scope, the app does not open the event and shows the localized no-permission message without exposing title, participant, category, location, notes, reminder, or transportation details.

Notification safety:

Owner/admin push enrollment continues to work. Restricted users only see/use notification controls when `receive_notifications` is granted. Family-wide push delivery should be revisited before broad external sharing so targeted notification routing can fully replace family-wide delivery for restricted accounts.

Production validation plan:

1. Apply `migrations/0005_permission_shared_views.sql` to production D1.
2. Redeploy Pages without removing Basic Auth.
3. Sign in as owner/admin and confirm the full schedule still loads.
4. Create a member/viewer invite, accept it, and confirm the account initially sees the access-pending state.
5. As owner/admin, create a Shared View for Daniel + Basketball with `view_schedule`; refresh the restricted account and confirm only Daniel basketball appears.
6. Create a Shared View for Emanuel + School/Dance and confirm Daniel events, locations, notes, transportation, reminders, filters, and Today in the Family summaries do not leak.
7. Test an unauthorized deep link and confirm only the permission message appears.
8. Grant/remove permissions and confirm the next `/api/shared` refresh reflects the change without deleting the account.
9. Confirm restricted users cannot create/edit/delete events or transportation outside scope.
10. Confirm disabled accounts still receive zero data.

## Web Push Notifications

Web Push delivery is server-side. The browser registers a Service Worker and stores a PushSubscription in D1 through protected same-origin `/api/push`; reminder timing is handled by the dedicated Cloudflare Worker in `workers/push-scheduler`.

Architecture:

- The frontend never schedules notifications with timers or polling.
- The Service Worker file is `public/push-service-worker.js`.
- `/api/push` returns the VAPID public key, registers or disables the current browser subscription, and sends a server-originated test push.
- Push subscriptions are infrastructure data and are not included in normal `/api/shared` schedule bootstrap payloads.
- The scheduler Worker runs every minute via Cron, reads D1 schedule/reminder rows, imports the shared pure Schedule Engine, resolves final occurrences including `EventException`, converts local family times to UTC, and sends due reminders.
- Notification clicks open the existing deep-link format: `?eventId=<eventId>&date=YYYY-MM-DD`.

Required Pages/Worker non-secret variables:

- `VAPID_PUBLIC_KEY`
- `VAPID_SUBJECT`, for example a `mailto:` contact
- `FAMILY_TIME_ZONE=Asia/Jerusalem`
- Optional: `NOTIFICATION_LANGUAGE=he` or `en`

Required Worker secret:

- `VAPID_PRIVATE_KEY`

Do not put `VAPID_PRIVATE_KEY` in Vite variables, React source, localStorage, D1, docs, or Git.

Generate a VAPID key pair locally:

```bash
npm run vapid:generate
```

Copy the public key to Cloudflare as a non-secret variable. Copy the private key directly into a Cloudflare Worker Secret. Do not save generated private keys into the repository.

Worker deployment:

1. Apply `migrations/0003_push_notifications.sql` to `family-logistics-db`.
2. In `workers/push-scheduler/wrangler.toml`, replace `REPLACE_WITH_PRODUCTION_D1_DATABASE_ID` with the existing production D1 database id.
3. Configure the Worker D1 binding:
   - Binding name: `FAMILY_DB`
   - Database name: `family-logistics-db`
4. Configure Worker variables:
   - `VAPID_PUBLIC_KEY`
   - `VAPID_SUBJECT`
   - `FAMILY_TIME_ZONE=Asia/Jerusalem`
   - Optional `NOTIFICATION_LANGUAGE`
5. Configure Worker secret:
   - `VAPID_PRIVATE_KEY`
6. Deploy the Worker.
7. Confirm the Cron Trigger is `* * * * *`.
8. Deploy the Pages frontend changes.

Retry behavior:

- A successful notification creates/updates a `notification_deliveries` row as `sent`.
- The uniqueness rule on `reminder_id + subscription_id + scheduled_for_utc` prevents normal duplicate same-device deliveries.
- Temporary push failures are retried up to 3 attempts.
- Permanent `404` or `410` push responses disable the subscription.
- A sent delivery is never retried.

Troubleshooting:

- If the UI shows unsupported, the current browser lacks Service Worker, PushManager, or Notification support.
- If the UI shows permission denied, change the browser/site notification permission manually.
- If test push fails, verify Basic Auth, `/api/push`, VAPID variables/secrets, the D1 migration, and the service worker registration.
- If scheduled reminders do not arrive, verify the Worker D1 binding, Cron Trigger, Worker logs, `FAMILY_TIME_ZONE`, VAPID secrets, and `notification_deliveries` rows.

Manual push validation plan:

1. Apply `migrations/0003_push_notifications.sql` in Cloudflare Dashboard -> D1 -> `family-logistics-db` -> Console.
2. Configure the Worker D1 binding `FAMILY_DB` to `family-logistics-db`.
3. Configure VAPID public variable, private secret, subject, and `FAMILY_TIME_ZONE=Asia/Jerusalem`.
4. Deploy the push scheduler Worker.
5. Verify Cron is `* * * * *`.
6. Deploy the Pages changes.
7. Open the private app, authenticate, and click App Info -> Enable notifications.
8. Click Send test notification.
9. Create an event 5-10 minutes in the future.
10. Configure a reminder that becomes due soon.
11. Close the Family Logistics Assistant tab.
12. Verify the notification still arrives.
13. Click the notification.
14. Verify the exact occurrence opens through `?eventId=<eventId>&date=<occurrenceDate>`.
15. Repeat on a second subscribed device.
16. Verify later Cron runs do not duplicate the same notification on the same device.

## CSV Schedule Import

Version `0.14.5` adds an authenticated CSV and pasted weekly schedule import flow for users who can edit schedules. No D1 migration is required for this feature; imported rows are stored as normal custom events in the existing `custom_events` table.

Supported CSV format:

- UTF-8 CSV, including Hebrew text and UTF-8 BOM.
- Quoted fields, quoted commas, empty cells, CRLF, and LF line endings.
- MVP limits: about 2 MB per file and up to 1000 data rows.
- Common columns: `date`, `day`, `start_time`, `end_time`, `title`, `location`, `notes`, and `category`.
- Date values support `YYYY-MM-DD`, `DD/MM/YYYY`, and `DD.MM.YYYY`.
- Time values support `HH:mm`, `HH:mm:ss`, and common AM/PM values such as `6:30 PM`.
- Official game CSV files also support `DD-MM-YYYY` dates such as `08-10-2026` and lowercase AM/PM times such as `7:00 pm`.
- Official game CSV headers map automatically: `Subject`, `Start Date`, `End Date`, `Start Time`, `End Time`, blank column, `Home Team`, `Away Team`, and `Location`.

Import modes:

- Dated schedule: rows with exact dates become one-time custom events.
- Weekly recurring schedule: rows with weekdays become recurring custom events using the existing recurrence model. The user chooses the effective start date and optional end date.
- Weekly schedule text: pasted WhatsApp-style text is resolved to one concrete Sunday-Saturday target week and imported as one-time events, not recurrence.
- Imported events remain normal editable custom events, appear in the weekly schedule, obey filters and Shared View permissions, support deep links, and can receive reminders.

Authorization behavior:

- The Import schedule control is shown only to users with schedule edit access.
- The target member must be selected explicitly.
- The server revalidates authentication, `edit_schedule`, member scope, category scope, row validity, and duplicate candidates before inserting events.
- Restricted editors cannot import into hidden or unauthorized members/categories by modifying the browser payload.

Duplicate detection:

- Likely duplicates are detected by member, date or weekly recurrence day, start time, and normalized title/category.
- Duplicate preview rows default to unselected.
- The server rechecks duplicates and skips obvious duplicate rows instead of importing them silently.

Daniel basketball CSV example:

```csv
Date,Start Time,End Time,Title,Location,Notes
2026-10-03,18:30,20:00,Training,Sports hall,Bring shoes
2026-10-10,18:30,20:00,Training,Sports hall,
```

Production validation procedure:

1. Sign in as an owner/admin or a user with `edit_schedule` for Daniel and Basketball.
2. Open Import schedule near the schedule management controls.
3. Upload the CSV, choose Daniel as the target member, and choose Basketball as the default activity.
4. Confirm the detected column mapping and preview statuses.
5. Deselect any duplicate or unwanted rows.
6. Import selected rows and confirm the result counts.
7. Click View imported schedule and verify the events appear in the weekly dashboard.
8. Verify Daniel/Basketball filters show the imported rows.
9. Verify a restricted viewer can see only imported events inside their Shared View scope.
10. Open an imported event and confirm existing edit/delete/reminder behavior still works.

Daniel official game CSV workflow:

```csv
Subject,Start Date,End Date,Start Time,End Time,,Home Team,Away Team,Location
"(בית) משחק ליגה",08-10-2026,08-10-2026,7:00 pm,9:00 pm,,מ.ס. אבן יהודה,מכבי תל מונד הדס,"אולם ""רלף"", אבן יהודה"
```

1. Open Import schedule.
2. Choose CSV file.
3. Choose Daniel as the target member and Basketball as the default activity.
4. Upload the official file without editing the source CSV.
5. Confirm that `Subject` maps to title, `Start Date` maps to date, `Start Time` and `End Time` normalize to 24-hour time, and `Location` preserves quoted commas and doubled quotes.
6. Confirm Home Team and Away Team are retained in event notes.
7. Import selected rows and verify the games appear as one-time Basketball events.

Daniel weekly WhatsApp schedule workflow:

```text
לו״ז
שבת 16:00
ראשון 09:00 רלף
שלישי 19:00 רלף
רביעי 17:15 אתלטיקה
          18:00 רלף
חמישי משחק אימון בהוד השרון אעדכן שעת הסעה
```

1. Open Import schedule.
2. Choose Weekly schedule text.
3. Choose Daniel and Basketball.
4. Choose the target week. The app resolves weekdays into exact dates for that Sunday-Saturday week.
5. Paste the message.
6. Confirm continuation lines inherit the previous weekday.
7. Correct any missing time directly in Preview. Rows with missing time cannot be imported until corrected or deselected.
8. Leave Update weekly schedule enabled when replacing a prior WhatsApp weekly training import for the same Daniel/Basketball/week.
9. Confirm replacement safety: only prior `whatsapp_weekly` imported training rows for that member/category/week are replaced. Official game CSV events, manual events, school, dance, other members, and basketball events with unknown source are preserved.

## Multi-Participant Events

Version `0.14.6` adds multi-participant event support without a D1 migration. Custom events are already stored as JSON payloads in `custom_events`, so `participantIds` is additive. Legacy events that only have `childId` are interpreted as `participantIds = [childId]`.

Data model:

- `participantIds` is the canonical participant list for new and edited events.
- `childId` remains as the first participant for backwards compatibility with existing event IDs, reminders, transportation, deep links, and older stored payloads.
- Seed events and old local/D1 events continue to behave as single-participant events.
- CSV and weekly pasted imports remain simple one-target imports and create `participantIds = [targetMemberId]`.

Permission semantics:

- View access requires an allowed category and at least one authorized participant.
- Edit access for restricted editors requires the allowed category and edit access to every current/requested participant.
- Owner/admin access is unchanged.
- `/api/shared` redacts unauthorized participant IDs before sending events to the browser. Hidden participant IDs/names must not appear in cards, details, Action Center, filters, summaries, or API JSON.

Filtering behavior:

- The participant filter has an explicit All chip.
- Selecting one or more participants makes All inactive.
- Choosing All clears individual participant filtering and returns to all authorized participants.
- A shared event matches if any visible participant is selected and is rendered once.

Production validation procedure:

1. Sign in as owner/admin.
2. Create one Family event with Daniel and Emanuel selected.
3. Verify it appears once in the schedule.
4. Filter Daniel only: event remains visible.
5. Filter Emanuel only: same event remains visible.
6. Filter an unrelated participant only: event is hidden.
7. Edit the same event and add/remove a participant. Confirm the same event ID is updated, not duplicated.
8. Sign in as a restricted viewer with access only to Daniel and the event category.
9. Verify the shared event is visible but only Daniel is displayed.
10. Confirm Event Details and Action Center do not reveal Emanuel.
11. Try a restricted edit without access to all participants and verify it is rejected.
12. Verify existing reminders, transportation plans, deep links, CSV imports, and WhatsApp weekly imports still work.

## Israel Calendar Sources

Version `0.14.8` adds read-only system calendar sources. These are resolved alongside custom schedule events but are not stored in `custom_events` and cannot be edited, deleted, moved, assigned rides, or counted as timed conflicts.

Architecture:

- `SystemCalendarEvent` represents provider-driven all-day context with `source`, `type`, `startDate`, `endDate`, source metadata, and participant applicability.
- `src/services/calendarSources/israelHolidays.ts` provides the Israel holiday source using a versioned Hebcal-attributed normalized dataset with Israel mode metadata (`i=on`).
- `src/services/calendarSources/ministryEducationVacations.ts` provides a versioned Ministry of Education vacation dataset for school year `2026-2027`.
- `src/services/calendarSources/calendarSourceService.ts` combines enabled sources, normalizes settings, filters by visible participants/date/source type, and catches provider failures so the family schedule continues to load.
- Dashboard code consumes system events separately from editable `Event` records. They render as compact all-day banners and open a read-only source details panel.

Hebcal source:

- Source attribution: Hebcal Israel calendar, `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&mod=on&i=on`.
- Israel mode is mandatory. Tests verify Israel-specific behavior, including no Diaspora second day for Shavuot.
- Major Jewish holidays and modern Israeli national observances are included by default.
- Minor observances are disabled by default and can be enabled from Calendar sources.
- Holiday dates are represented as civil all-day dates, not fake timed appointments.

Ministry of Education source:

- Source attribution: Israel Ministry of Education vacation calendar, `https://pop.education.gov.il/maagal_hashana/vacation-schedule/`.
- The current normalized dataset is for Jewish official education, middle school, school year `2026-2027`.
- The provider is profile-aware (`sector`, `level`, `schoolYear`) so future school years or sectors can be added without changing dashboard logic.
- Generic defaults do not include family-specific participant IDs. Owner/admin users must select the schedule members covered by the Ministry profile in Calendar sources; for the current family workspace, select Daniel and Emanuel during production validation.
- Vacation ranges remain one logical system event even when surfaced on multiple dashboard dates.

Persistence and refresh:

- Migration `migrations/0006_calendar_sources.sql` adds `workspace_calendar_sources` for workspace-level settings.
- The app can load safely before migration 0006 is applied by falling back to default source settings. Owner/admin changes require migration 0006.
- The Refresh sources control updates/recalculates the stored source settings timestamp. The current providers are local/versioned, so no live scrape, repeated remote browser fetch, or cache table is required.
- Provider text is treated as plain text. No HTML from source data is rendered.

Production validation procedure:

1. Deploy the code after committing.
2. Apply `migrations/0006_calendar_sources.sql` exactly once to the production D1 database.
3. Sign in as owner/admin and confirm Calendar sources is visible.
4. Before selecting students, verify the Ministry source shows a clear message asking to select participants.
5. Select Daniel and Emanuel as Ministry calendar participants and save.
6. Verify Israeli holidays and Ministry vacations can be enabled/disabled.
7. Verify Rosh Hashana appears as one range from `2026-09-12` through `2026-09-13`.
8. Verify the overlapping school vacation appears separately from the holiday.
9. Filter Daniel: holidays and relevant school vacations remain visible.
10. Filter a non-student participant: holidays remain visible and school vacations are hidden unless configured for that participant.
11. Open a system event details panel and verify source/date/read-only metadata appears and no edit/delete controls are shown.
12. Verify Action Center lists each holiday/vacation once and transportation conflict detection ignores all-day system context.

## Manual Deployment Steps

1. Commit the current project state to Git.
2. Push the repository to the private Git host that will be connected to Cloudflare Pages.
3. In Cloudflare, create a new Pages project.
4. Connect the Git repository.
5. Configure the build settings exactly as listed above.
6. Run the first Pages deployment.
7. Before sharing the deployed URL, configure the required encrypted Secrets for the Pages Function password gate.
8. Create the D1 database, apply the SQL migration, and add the `FAMILY_DB` binding.
9. Redeploy after the secrets and D1 binding are configured.
10. Open the deployment URL in an Incognito/private browser.
11. Confirm the app is blocked until valid shared-family HTTP Basic Authentication credentials are entered.
12. After authentication, confirm the app loads normally.

## Local Browser Data Migration

The shared family dashboard now stores mutable schedule data in D1. Older browser-local data may still exist in `localStorage`; the app can offer to import it into the shared dashboard after authentication. Do not delete existing browser data during deployment testing unless you intentionally want to reset that browser's local fallback data.

## Production Safety Checklist

Before sharing the private URL:

- `npm run test` passes.
- `npm run build` passes.
- `npm run worker:build` passes.
- Cloudflare Pages serves the `dist` output.
- `FAMILY_AUTH_USERNAME` and `FAMILY_AUTH_PASSWORD` are configured as encrypted Cloudflare Pages Secrets.
- `FAMILY_DB` is bound to the Cloudflare Pages project.
- `migrations/0001_shared_family_data.sql`
- `migrations/0002_event_reminders.sql` has been applied to the D1 database.
- `migrations/0003_push_notifications.sql` has been applied to the D1 database.
- `migrations/0004_authentication_members.sql` has been applied to the D1 database.
- `migrations/0005_permission_shared_views.sql` has been applied to the D1 database.
- `migrations/0006_calendar_sources.sql` has been applied to the D1 database.
- `AUTH_BOOTSTRAP_TOKEN` is configured as an encrypted Cloudflare Pages Secret before first-owner setup.
- First-owner bootstrap succeeds exactly once.
- Login, logout, invite acceptance, account disable, and session revoke are manually verified.
- The Pages Function password gate is verified in an Incognito/private browser.
- The app works at desktop, tablet, and phone widths.
- Hebrew mode uses RTL.
- English mode uses LTR.
- Light and dark themes both render legibly.
- Add/edit event dialogs, child dialog, transportation dialog, filters, weekly schedule, and Family Action Center are usable.
- No secrets, API keys, or credentials are committed.

## Not Included Yet

This deployment does not include:

- External calendar APIs
- WhatsApp integration
- AI features
- Maps
- SMS/email/WhatsApp notification delivery
- Per-user notification routing
- Analytics or tracking
