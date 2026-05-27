create extension if not exists "pgcrypto";

create type app_role as enum ('admin', 'faculty', 'student');
create type lecture_status as enum ('draft', 'scheduled', 'live', 'completed', 'cancelled');
create type attendance_status as enum ('present', 'absent', 'late', 'excused');
create type recording_job_status as enum ('queued', 'processing', 'completed', 'failed');
create type chat_thread_type as enum ('group', 'direct');
create type resource_kind as enum ('pdf', 'document', 'image', 'video', 'presentation', 'other');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  phone text,
  full_name text not null,
  role app_role not null default 'student',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table faculty_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  employee_code text unique,
  department text,
  zoom_host_user_id text unique,
  created_at timestamptz not null default now()
);

create table student_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  roll_number text unique,
  guardian_phone text,
  created_at timestamptz not null default now()
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table group_students (
  group_id uuid not null references groups(id) on delete cascade,
  student_id uuid not null references student_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, student_id)
);

create table lectures (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  group_id uuid not null references groups(id) on delete restrict,
  faculty_id uuid not null references faculty_profiles(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status lecture_status not null default 'scheduled',
  attendance_threshold_percent numeric(5,2) not null default 70,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lectures_time_order check (ends_at > starts_at)
);

create table zoom_meetings (
  id uuid primary key default gen_random_uuid(),
  lecture_id uuid not null unique references lectures(id) on delete cascade,
  zoom_meeting_id text not null unique,
  zoom_uuid text,
  host_id text not null,
  join_url text not null,
  start_url text,
  password text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  lecture_id uuid not null references lectures(id) on delete cascade,
  student_id uuid not null references student_profiles(id) on delete cascade,
  duration_minutes numeric(8,2) not null default 0,
  required_minutes numeric(8,2) not null default 0,
  status attendance_status not null default 'absent',
  source text not null default 'zoom',
  calculated_at timestamptz not null default now(),
  unique (lecture_id, student_id)
);

create table attendance_overrides (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references attendance(id) on delete cascade,
  status attendance_status not null,
  reason text not null,
  corrected_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table recordings (
  id uuid primary key default gen_random_uuid(),
  lecture_id uuid references lectures(id) on delete set null,
  zoom_meeting_id text not null,
  zoom_recording_id text,
  drive_file_id text,
  view_url text,
  download_url text,
  duration_seconds integer,
  file_size_bytes bigint,
  created_at timestamptz not null default now()
);

create table recording_jobs (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid references recordings(id) on delete cascade,
  zoom_download_url text not null,
  status recording_job_status not null default 'queued',
  attempts integer not null default 0,
  last_error text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table resources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete restrict,
  group_id uuid not null references groups(id) on delete cascade,
  title text not null,
  kind resource_kind not null default 'other',
  size_bytes bigint not null default 0,
  drive_file_id text not null,
  view_url text not null,
  download_url text,
  created_at timestamptz not null default now()
);

create table chat_threads (
  id uuid primary key default gen_random_uuid(),
  type chat_thread_type not null,
  group_id uuid references groups(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table chat_thread_members (
  thread_id uuid not null references chat_threads(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (thread_id, profile_id)
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references chat_threads(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete restrict,
  body text not null,
  created_at timestamptz not null default now()
);

create table notices (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  title text not null,
  body text not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table remarks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references student_profiles(id) on delete cascade,
  faculty_id uuid references faculty_profiles(id) on delete set null,
  lecture_id uuid references lectures(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table system_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table integration_settings (
  key text primary key,
  value jsonb not null,
  encrypted boolean not null default false,
  updated_at timestamptz not null default now()
);

create index idx_lectures_group_time on lectures(group_id, starts_at);
create index idx_attendance_lecture on attendance(lecture_id);
create index idx_resources_group on resources(group_id, created_at desc);
create index idx_recording_jobs_status on recording_jobs(status, created_at);
create index idx_chat_messages_thread on chat_messages(thread_id, created_at);
