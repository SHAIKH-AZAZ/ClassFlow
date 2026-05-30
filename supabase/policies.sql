-- Idempotent RLS policy script. Safe to re-run.
--
-- NOTE on recursion: Several tables reference each other (lectures join
-- group_students join faculty_profiles, etc.). To avoid infinite recursion in
-- RLS evaluation, all cross-table predicates go through SECURITY DEFINER helper
-- functions that bypass RLS for the inner lookup. The owner of each helper
-- function (postgres) is what actually executes the inner select.

alter table profiles enable row level security;
alter table faculty_profiles enable row level security;
alter table student_profiles enable row level security;
alter table groups enable row level security;
alter table group_students enable row level security;
alter table lectures enable row level security;
alter table zoom_meetings enable row level security;
alter table attendance enable row level security;
alter table attendance_overrides enable row level security;
alter table recordings enable row level security;
alter table recording_jobs enable row level security;
alter table resources enable row level security;
alter table chat_threads enable row level security;
alter table chat_thread_members enable row level security;
alter table chat_messages enable row level security;
alter table notices enable row level security;
alter table remarks enable row level security;
alter table system_logs enable row level security;
alter table integration_settings enable row level security;

-- ----------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER bypasses RLS for the inner SELECTs).
-- ----------------------------------------------------------------------------

create or replace function current_profile_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

create or replace function is_faculty()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'faculty')
$$;

create or replace function is_student()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'student')
$$;

create or replace function current_student_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from student_profiles where user_id = auth.uid()
$$;

create or replace function current_faculty_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from faculty_profiles where user_id = auth.uid()
$$;

create or replace function student_in_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from group_students gs
    join student_profiles sp on sp.id = gs.student_id
    where gs.group_id = p_group_id and sp.user_id = auth.uid()
  )
$$;

create or replace function faculty_teaches_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from lectures l
    join faculty_profiles fp on fp.id = l.faculty_id
    where l.group_id = p_group_id and fp.user_id = auth.uid()
  )
$$;

create or replace function faculty_owns_lecture(p_lecture_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from lectures l
    join faculty_profiles fp on fp.id = l.faculty_id
    where l.id = p_lecture_id and fp.user_id = auth.uid()
  )
$$;

create or replace function student_in_lecture_group(p_lecture_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from lectures l
    join group_students gs on gs.group_id = l.group_id
    join student_profiles sp on sp.id = gs.student_id
    where l.id = p_lecture_id and sp.user_id = auth.uid()
  )
$$;

create or replace function profile_is_chat_member(p_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from chat_thread_members
    where thread_id = p_thread_id and profile_id = auth.uid()
  )
$$;

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
drop policy if exists "profiles_self_or_admin_read" on profiles;
create policy "profiles_self_or_admin_read" on profiles
  for select using (id = auth.uid() or is_admin());

drop policy if exists "profiles_admin_write" on profiles;
create policy "profiles_admin_write" on profiles
  for all using (is_admin()) with check (is_admin());

-- ----------------------------------------------------------------------------
-- faculty_profiles
-- ----------------------------------------------------------------------------
drop policy if exists "faculty_profiles_self_or_admin_read" on faculty_profiles;
create policy "faculty_profiles_self_or_admin_read" on faculty_profiles
  for select using (
    is_admin() or user_id = auth.uid()
  );

drop policy if exists "faculty_profiles_admin_write" on faculty_profiles;
create policy "faculty_profiles_admin_write" on faculty_profiles
  for all using (is_admin()) with check (is_admin());

-- ----------------------------------------------------------------------------
-- student_profiles
-- ----------------------------------------------------------------------------
drop policy if exists "student_profiles_self_or_admin_read" on student_profiles;
create policy "student_profiles_self_or_admin_read" on student_profiles
  for select using (
    is_admin() or user_id = auth.uid()
  );

drop policy if exists "student_profiles_admin_write" on student_profiles;
create policy "student_profiles_admin_write" on student_profiles
  for all using (is_admin()) with check (is_admin());

-- ----------------------------------------------------------------------------
-- groups
-- ----------------------------------------------------------------------------
drop policy if exists "groups_admin_all" on groups;
create policy "groups_admin_all" on groups
  for all using (is_admin()) with check (is_admin());

drop policy if exists "groups_member_read" on groups;
create policy "groups_member_read" on groups
  for select using (
    is_admin() or student_in_group(id) or faculty_teaches_group(id)
  );

-- ----------------------------------------------------------------------------
-- group_students
-- ----------------------------------------------------------------------------
drop policy if exists "group_students_admin_all" on group_students;
create policy "group_students_admin_all" on group_students
  for all using (is_admin()) with check (is_admin());

drop policy if exists "group_students_member_read" on group_students;
create policy "group_students_member_read" on group_students
  for select using (
    is_admin()
    or student_id = current_student_profile_id()
    or faculty_teaches_group(group_id)
  );

-- ----------------------------------------------------------------------------
-- lectures
-- ----------------------------------------------------------------------------
drop policy if exists "lectures_admin_faculty_write" on lectures;
create policy "lectures_admin_faculty_write" on lectures
  for all using (
    is_admin() or faculty_id = current_faculty_profile_id()
  ) with check (
    is_admin() or faculty_id = current_faculty_profile_id()
  );

drop policy if exists "lectures_group_student_read" on lectures;
create policy "lectures_group_student_read" on lectures
  for select using (
    is_admin()
    or faculty_id = current_faculty_profile_id()
    or student_in_group(group_id)
  );

-- ----------------------------------------------------------------------------
-- zoom_meetings
-- ----------------------------------------------------------------------------
drop policy if exists "zoom_meetings_read" on zoom_meetings;
create policy "zoom_meetings_read" on zoom_meetings
  for select using (
    is_admin()
    or faculty_owns_lecture(lecture_id)
    or student_in_lecture_group(lecture_id)
  );

drop policy if exists "zoom_meetings_admin_faculty_write" on zoom_meetings;
create policy "zoom_meetings_admin_faculty_write" on zoom_meetings
  for all using (
    is_admin() or faculty_owns_lecture(lecture_id)
  ) with check (
    is_admin() or faculty_owns_lecture(lecture_id)
  );

-- ----------------------------------------------------------------------------
-- attendance
-- ----------------------------------------------------------------------------
drop policy if exists "attendance_visible_to_owner_faculty_admin" on attendance;
create policy "attendance_visible_to_owner_faculty_admin" on attendance
  for select using (
    is_admin()
    or student_id = current_student_profile_id()
    or faculty_owns_lecture(lecture_id)
  );

drop policy if exists "attendance_admin_faculty_write" on attendance;
create policy "attendance_admin_faculty_write" on attendance
  for all using (
    is_admin() or faculty_owns_lecture(lecture_id)
  ) with check (
    is_admin() or faculty_owns_lecture(lecture_id)
  );

-- ----------------------------------------------------------------------------
-- attendance_overrides
-- ----------------------------------------------------------------------------
drop policy if exists "attendance_overrides_read" on attendance_overrides;
create policy "attendance_overrides_read" on attendance_overrides
  for select using (
    is_admin()
    or exists (
      select 1 from attendance a
      where a.id = attendance_overrides.attendance_id
        and (
          a.student_id = current_student_profile_id()
          or faculty_owns_lecture(a.lecture_id)
        )
    )
  );

drop policy if exists "attendance_overrides_admin_faculty_write" on attendance_overrides;
create policy "attendance_overrides_admin_faculty_write" on attendance_overrides
  for all using (
    is_admin()
    or exists (
      select 1 from attendance a
      where a.id = attendance_overrides.attendance_id
        and faculty_owns_lecture(a.lecture_id)
    )
  ) with check (
    is_admin()
    or exists (
      select 1 from attendance a
      where a.id = attendance_overrides.attendance_id
        and faculty_owns_lecture(a.lecture_id)
    )
  );

-- ----------------------------------------------------------------------------
-- recordings
-- ----------------------------------------------------------------------------
drop policy if exists "recordings_read" on recordings;
create policy "recordings_read" on recordings
  for select using (
    is_admin()
    or (lecture_id is not null and faculty_owns_lecture(lecture_id))
    or (lecture_id is not null and student_in_lecture_group(lecture_id))
  );

drop policy if exists "recordings_admin_faculty_write" on recordings;
create policy "recordings_admin_faculty_write" on recordings
  for all using (
    is_admin() or (lecture_id is not null and faculty_owns_lecture(lecture_id))
  ) with check (
    is_admin() or (lecture_id is not null and faculty_owns_lecture(lecture_id))
  );

-- ----------------------------------------------------------------------------
-- recording_jobs (admin only)
-- ----------------------------------------------------------------------------
drop policy if exists "recording_jobs_admin_only" on recording_jobs;
create policy "recording_jobs_admin_only" on recording_jobs
  for all using (is_admin()) with check (is_admin());

-- ----------------------------------------------------------------------------
-- resources
-- ----------------------------------------------------------------------------
drop policy if exists "resources_group_visible" on resources;
create policy "resources_group_visible" on resources
  for select using (
    is_admin()
    or owner_id = auth.uid()
    or student_in_group(group_id)
    or faculty_teaches_group(group_id)
  );

drop policy if exists "resources_admin_faculty_write" on resources;
create policy "resources_admin_faculty_write" on resources
  for all using (
    is_admin() or owner_id = auth.uid() or current_profile_role() = 'faculty'
  ) with check (
    is_admin() or owner_id = auth.uid() or current_profile_role() = 'faculty'
  );

-- ----------------------------------------------------------------------------
-- chat_threads
-- ----------------------------------------------------------------------------
drop policy if exists "chat_threads_member_read" on chat_threads;
create policy "chat_threads_member_read" on chat_threads
  for select using (is_admin() or profile_is_chat_member(id));

drop policy if exists "chat_threads_create" on chat_threads;
create policy "chat_threads_create" on chat_threads
  for insert with check (auth.uid() is not null);

drop policy if exists "chat_threads_admin_write" on chat_threads;
create policy "chat_threads_admin_write" on chat_threads
  for update using (is_admin() or created_by = auth.uid())
  with check (is_admin() or created_by = auth.uid());

drop policy if exists "chat_threads_admin_delete" on chat_threads;
create policy "chat_threads_admin_delete" on chat_threads
  for delete using (is_admin() or created_by = auth.uid());

-- ----------------------------------------------------------------------------
-- chat_thread_members
-- ----------------------------------------------------------------------------
drop policy if exists "chat_thread_members_read" on chat_thread_members;
create policy "chat_thread_members_read" on chat_thread_members
  for select using (
    is_admin()
    or profile_id = auth.uid()
    or profile_is_chat_member(thread_id)
  );

drop policy if exists "chat_thread_members_admin_write" on chat_thread_members;
create policy "chat_thread_members_admin_write" on chat_thread_members
  for all using (is_admin()) with check (is_admin());

-- ----------------------------------------------------------------------------
-- chat_messages
-- ----------------------------------------------------------------------------
drop policy if exists "chat_member_read" on chat_messages;
create policy "chat_member_read" on chat_messages
  for select using (is_admin() or profile_is_chat_member(thread_id));

drop policy if exists "chat_member_insert" on chat_messages;
create policy "chat_member_insert" on chat_messages
  for insert with check (
    sender_id = auth.uid() and profile_is_chat_member(thread_id)
  );

-- ----------------------------------------------------------------------------
-- notices
-- ----------------------------------------------------------------------------
drop policy if exists "notices_read" on notices;
create policy "notices_read" on notices
  for select using (
    is_admin()
    or group_id is null
    or student_in_group(group_id)
    or faculty_teaches_group(group_id)
  );

drop policy if exists "notices_admin_faculty_write" on notices;
create policy "notices_admin_faculty_write" on notices
  for all using (
    is_admin() or current_profile_role() = 'faculty'
  ) with check (
    is_admin() or current_profile_role() = 'faculty'
  );

-- ----------------------------------------------------------------------------
-- remarks
-- ----------------------------------------------------------------------------
drop policy if exists "remarks_read" on remarks;
create policy "remarks_read" on remarks
  for select using (
    is_admin()
    or student_id = current_student_profile_id()
    or faculty_id = current_faculty_profile_id()
  );

drop policy if exists "remarks_admin_faculty_write" on remarks;
create policy "remarks_admin_faculty_write" on remarks
  for all using (
    is_admin() or current_profile_role() = 'faculty'
  ) with check (
    is_admin() or current_profile_role() = 'faculty'
  );

-- ----------------------------------------------------------------------------
-- system_logs
-- ----------------------------------------------------------------------------
drop policy if exists "system_logs_admin_read" on system_logs;
create policy "system_logs_admin_read" on system_logs
  for select using (is_admin());

-- ----------------------------------------------------------------------------
-- integration_settings
-- ----------------------------------------------------------------------------
drop policy if exists "integration_settings_admin_only" on integration_settings;
create policy "integration_settings_admin_only" on integration_settings
  for all using (is_admin()) with check (is_admin());
