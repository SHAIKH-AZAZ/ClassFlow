# Role-Based Feature Separation And Pending Features Plan

## Current State

Already implemented:

- Supabase schema exists.
- Auth users and test profiles exist.
- Login page works.
- Zoom meeting creation works.
- Faculty Zoom host mapping works.
- Zoom Basic recording path is chosen.
- Manual recording upload API/UI exists, pending Google Drive credential verification.
- Basic pages exist: `/admin`, `/faculty`, `/reports`, `/settings`, `/login`.

Partially implemented:

- RLS policies exist but are incomplete.
- Login reads role, but page/API protection is not complete.
- Faculty page has an upload form, but not a complete lecture management workflow.
- Admin/faculty/student dashboards are placeholders.

Not implemented:

- Full role-based feature separation.
- Student dashboard.
- Attendance review/correction UI.
- Resource upload UI.
- Google Drive upload verification.
- Chat, notices, and remarks.
- Real mobile auth/data flows.

## Recommended Implementation Order

1. Auth and role security first.
   - Add server-side Supabase session handling.
   - Add middleware/page guards.
   - Add role-aware redirects.
   - Add API route authorization.
   - Add role-based sidebar navigation.
   - Expected behavior:
     - `admin` logs in -> `/admin`
     - `faculty` logs in -> `/faculty`
     - `student` logs in -> `/student`
     - wrong-role pages redirect away
     - wrong-role API calls return `403`

2. Student dashboard.
   - Add `/student`.
   - Show only the signed-in student's:
     - enrolled group
     - lectures
     - Zoom join links
     - recordings
     - resources
     - attendance rows
   - Use this dashboard to prove access control works end to end.

3. Faculty lecture workflow.
   - Replace placeholder faculty page with real workflows:
     - schedule lecture form
     - list own lectures
     - show Zoom start link
     - show student join link
     - upload local recording by selecting a lecture instead of typing raw lecture ID
     - upload resource to group
     - sync attendance
     - review/correct attendance

4. Admin management.
   - Add simple MVP tables/forms for:
     - faculty users
     - student users
     - groups
     - group enrollment
     - Zoom host email mapping
     - integration settings
     - reports

5. Google Drive upload completion.
   - Configure Google service account credentials.
   - Share the root Drive folder with the service account.
   - Test local recording upload.
   - Confirm uploaded recording is visible to the correct student.
   - Improve upload success/error UI.

6. Attendance.
   - Add faculty "Sync Attendance" action.
   - Add attendance table.
   - Show lecture threshold.
   - Add manual override form.
   - Add student attendance view.

7. Resources.
   - Add faculty/admin resource upload.
   - Upload files to Google Drive.
   - Insert resource metadata.
   - Add student resource list.
   - Enforce group-based access control.

8. RLS hardening.
   - Strengthen policies alongside feature work, not at the end.
   - Cover:
     - `faculty_profiles`
     - `student_profiles`
     - `group_students`
     - `zoom_meetings`
     - `recordings`
     - `resources` writes
     - `attendance_overrides`
     - `notices`
     - `remarks`

9. Chat, notices, and remarks.
   - Add after the core LMS flows work.
   - Implement:
     - group notices
     - faculty-to-student remarks
     - group chat
     - direct chat

10. Mobile app.
    - Build after web workflows stabilize.
    - Mobile MVP:
      - login
      - student schedule
      - Join Zoom
      - resources
      - recordings
      - attendance
      - notices/chat later

## Immediate Next Sprint

Focus only on security and the first real student experience:

1. Server-side auth/session setup.
2. Role-based page protection.
3. Role-based API protection.
4. Add `/student`.
5. Role-aware sidebar.
6. Verify admin/faculty/student logins.

This avoids building feature screens that later need to be rewritten when access control becomes stricter.

## Acceptance Criteria For Next Sprint

- Admin login lands on `/admin`.
- Faculty login lands on `/faculty`.
- Student login lands on `/student`.
- Unauthenticated users are redirected to `/login`.
- Students cannot access `/admin`, `/faculty`, `/settings`, or faculty/admin APIs.
- Faculty cannot access `/admin` or `/settings`.
- Protected API routes return `401` for unauthenticated requests.
- Protected API routes return `403` for wrong-role authenticated requests.
- Student can see only their enrolled group data.
- `bun run typecheck` passes.
- `bun run build` passes.
- Browser checks pass for `/login`, `/admin`, `/faculty`, and `/student`.

## Assumptions

- Keep the single-institute model.
- Keep Zoom Basic recording flow: local recording upload to Google Drive.
- Prioritize web dashboard and API security before mobile implementation.
- MVP admin/faculty screens can use simple tables and forms before UI polish.
