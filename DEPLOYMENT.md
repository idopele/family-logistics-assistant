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
- Iterations: `310000`.
- Salt: 16 cryptographically random bytes.
- Hash length: 32 bytes.
- Password policy: 10 to 256 characters. Spaces and symbols are allowed for password managers.

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

External sharing is NOT ready for real use until Step 14 adds the fine-grained permission engine and Shared Views. Viewer accounts are only a coarse foundation in Step 13.

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
