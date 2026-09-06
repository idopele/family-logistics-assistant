# Family Logistics Assistant

Frontend scaffold and TypeScript domain model for a future shared family logistics dashboard. The app is intentionally minimal for Sprint 0 / Step 2 and does not include calendar functionality, backend services, authentication, databases, external calendar APIs, WhatsApp APIs, or AI APIs.

## Tech Stack

- React
- TypeScript
- Vite
- npm

## Install

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Project Structure

```text
src/
  components/
  pages/
  features/
  services/
  models/
  data/
  utils/
  styles/
```

The application is configured for Hebrew RTL via `index.html` and global CSS.

## Domain Model

Import domain types from `src/models/index.ts`:

- `Child`: child identity, display name, color, and active state.
- `Event`: an event linked by `childId`, with category, required `startTime`, nullable `endTime` when the end time or duration is not yet known, optional recurrence, transportation details, status, and timestamps.
- `EventCategory`: a union of 14 supported category keys.
- `RecurrenceRule`: daily, weekly, or monthly recurrence with a positive interval, start date, and optional inclusive end date. Weekdays use 0 (Sunday) through 6 (Saturday).
- `EventException`: cancellation or modification of one recurring occurrence, identified by its original date. Omitted overrides preserve values; nullable overrides can clear them.

Dates use `YYYY-MM-DD`, local times use 24-hour `HH:mm`, and creation/update timestamps use ISO 8601. A one-time event uses `date`; a recurring event uses `recurrence.startDate` and may have a null `date`. These are domain conventions; TypeScript string/number fields do not enforce them at runtime.

`src/data/children.ts` seeds Daniel (דניאל) and Emmanuelle (עמנואל) with distinct colors. `src/data/eventCategories.ts` provides Hebrew labels for every category. `src/utils/dateTime.ts` exports `isValidTime` and `isValidDate`, including calendar-date and leap-year validation. No recurrence generation or UI integration is included in this step.
