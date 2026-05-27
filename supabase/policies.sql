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
alter table resources enable row level security;
alter table chat_threads enable row level security;
alter table chat_thread_members enable row level security;
alter table chat_messages enable row level security;
alter table notices enable row level security;
alter table remarks enable row level security;
alter table system_logs enable row level security;
alter table integration_settings enable row level security;

create or replace function current_profile_role()
returns app_role
language sql
stable
as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function is_admin()
returns boolean
language sql
stable
as $$
  select current_profile_role() = 'admin'
$$;

create policy "profiles_self_or_admin_read" on profiles
  for select using (id = auth.uid() or is_admin());

create policy "profiles_admin_write" on profiles
  for all using (is_admin()) with check (is_admin());

create policy "groups_admin_all" on groups
  for all using (is_admin()) with check (is_admin());

create policy "groups_member_read" on groups
  for select using (
    is_admin()
    or exists (
      select 1
      from group_students gs
      join student_profiles sp on sp.id = gs.student_id
      where gs.group_id = groups.id and sp.user_id = auth.uid()
    )
    or exists (
      select 1 from lectures l
      join faculty_profiles fp on fp.id = l.faculty_id
      where l.group_id = groups.id and fp.user_id = auth.uid()
    )
  );

create policy "lectures_admin_faculty_write" on lectures
  for all using (
    is_admin()
    or exists (select 1 from faculty_profiles fp where fp.id = lectures.faculty_id and fp.user_id = auth.uid())
  ) with check (
    is_admin()
    or exists (select 1 from faculty_profiles fp where fp.id = lectures.faculty_id and fp.user_id = auth.uid())
  );

create policy "lectures_group_student_read" on lectures
  for select using (
    is_admin()
    or exists (select 1 from faculty_profiles fp where fp.id = lectures.faculty_id and fp.user_id = auth.uid())
    or exists (
      select 1
      from group_students gs
      join student_profiles sp on sp.id = gs.student_id
      where gs.group_id = lectures.group_id and sp.user_id = auth.uid()
    )
  );

create policy "attendance_visible_to_owner_faculty_admin" on attendance
  for select using (
    is_admin()
    or exists (select 1 from student_profiles sp where sp.id = attendance.student_id and sp.user_id = auth.uid())
    or exists (
      select 1
      from lectures l
      join faculty_profiles fp on fp.id = l.faculty_id
      where l.id = attendance.lecture_id and fp.user_id = auth.uid()
    )
  );

create policy "resources_group_visible" on resources
  for select using (
    is_admin()
    or owner_id = auth.uid()
    or exists (
      select 1
      from group_students gs
      join student_profiles sp on sp.id = gs.student_id
      where gs.group_id = resources.group_id and sp.user_id = auth.uid()
    )
  );

create policy "chat_member_read" on chat_messages
  for select using (
    exists (
      select 1 from chat_thread_members ctm
      where ctm.thread_id = chat_messages.thread_id and ctm.profile_id = auth.uid()
    )
  );

create policy "chat_member_insert" on chat_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from chat_thread_members ctm
      where ctm.thread_id = chat_messages.thread_id and ctm.profile_id = auth.uid()
    )
  );
