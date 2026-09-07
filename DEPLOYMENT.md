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
- Production output directory: `dist`
- Client-side deep links: not currently used

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

The migration creates:

- `custom_children`
- `custom_events`
- `event_exceptions`
- `transportation_plans`
- `app_meta`

The existing Basic Auth middleware protects both the frontend and `/api/*` requests. Do not create unauthenticated API routes.

Manual Cloudflare setup:

1. Create a Cloudflare D1 database for the family dashboard.
2. Apply `migrations/0001_shared_family_data.sql` to that D1 database.
3. In the Cloudflare Pages project, add a D1 binding named `FAMILY_DB`.
4. Confirm `FAMILY_AUTH_USERNAME` and `FAMILY_AUTH_PASSWORD` are still configured as encrypted Secrets.
5. Redeploy the Pages project.
6. Open the deployed site in an Incognito/private browser and verify Basic Auth appears before the app or any `/api/*` request is served.
7. Confirm custom children, custom events, occurrence changes, and transportation plans sync between two browsers/devices after refresh or focus.

Do not document database IDs, API tokens, passwords, or secret values in the repository.

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

## localStorage MVP Limitation

All user-created data is currently stored in browser `localStorage`.

That means:

- Each browser/device has its own custom data.
- Adding an event on Device A does not make it appear on Device B.
- Adding a child on Device A does not make it appear on Device B.
- Transportation plans and occurrence changes are also device-local.
- Seed schedule data is common because it is bundled with the application.
- Shared synchronized family data will be implemented later with the backend.

Do not delete existing browser data during deployment testing unless you intentionally want to reset that browser's local MVP data.

## Production Safety Checklist

Before sharing the private URL:

- `npm run test` passes.
- `npm run build` passes.
- Cloudflare Pages serves the `dist` output.
- `FAMILY_AUTH_USERNAME` and `FAMILY_AUTH_PASSWORD` are configured as encrypted Cloudflare Pages Secrets.
- `FAMILY_DB` is bound to the Cloudflare Pages project.
- `migrations/0001_shared_family_data.sql` has been applied to the D1 database.
- The Pages Function password gate is verified in an Incognito/private browser.
- The app works at desktop, tablet, and phone widths.
- Hebrew mode uses RTL.
- English mode uses LTR.
- Light and dark themes both render legibly.
- Add/edit event dialogs, child dialog, transportation dialog, filters, weekly schedule, and Family Action Center are usable.
- No secrets, API keys, or credentials are committed.

## Not Included Yet

This deployment does not include:

- Backend
- Database
- In-app authentication
- Cross-device synchronization
- External calendar APIs
- WhatsApp integration
- AI features
- Maps
- Notifications
- Analytics or tracking
