# Zoom LMS Platform

Single-institute LMS and Zoom class platform with:

- `apps/web`: Next.js admin/faculty dashboard and API routes.
- `apps/mobile`: Expo React Native student/faculty mobile app shell.
- `apps/worker`: Optional Node worker that downloads Zoom cloud recordings and uploads them to Google Drive.
- `packages/shared`: shared roles, status constants, and TypeScript DTOs.
- `supabase`: PostgreSQL schema and row-level-security policy starting point.

## Phases Covered In This Scaffold

1. Supabase Auth role model, admin/faculty/student management tables, groups.
2. Lecture scheduling and Zoom meeting creation API.
3. Zoom participant attendance sync with configurable threshold and overrides.
4. Google Drive resource metadata, manual local recording uploads, optional recording webhook worker.
5. Chat, notices, remarks, logs, and integration settings schema.

## Setup

1. Create a Supabase project and run `supabase/schema.sql`, then `supabase/policies.sql`.
2. Configure OAuth/OTP providers in Supabase Auth.
3. Create a Zoom Server-to-Server OAuth app. For paid Zoom cloud recording, set webhook event subscriptions for `recording.completed`.
4. Create a Google service account or Workspace delegated app for Drive uploads.
5. Copy `.env.example` to `.env.local` for `apps/web` and to `.env` for `apps/worker`.
6. Install dependencies with `bun install`.
7. Run the dashboard with `bun run dev`.

## Important Environment Variables

See `.env.example` for the full list. Keep service-role, Zoom, and Google credentials only on trusted server environments.

## Main API Routes

- `POST /api/lectures`: create a lecture and Zoom meeting.
- `POST /api/attendance/sync`: calculate attendance from Zoom participant duration.
- `POST /api/zoom/webhooks`: enqueue recording jobs from Zoom webhooks.
- `POST /api/recordings/manual`: upload a local Zoom recording to Google Drive and save the recording link.
- `POST /api/resources`: create Google Drive metadata records for uploaded resources.

## MVP Boundaries

This is intentionally single-institute. There is no tenant table, billing model, marketplace, or cross-institute separation in v1.

## Zoom Basic Recording Flow

Zoom Basic does not support Zoom cloud recording. For Basic accounts:

1. Faculty records the meeting locally with Zoom's "Record to computer" option.
2. Faculty opens `/faculty`.
3. Faculty uploads the saved video file with the lecture ID.
4. The app uploads the file to Google Drive and stores a `recordings` row.

Set `ZOOM_AUTO_RECORDING=none` for Basic Zoom accounts. Use `cloud` only when the host account has licensed Zoom cloud recording.
