create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  full_name text not null,
  email text not null unique,
  role text not null check (role in ('admin', 'teacher', 'student')),
  bio text default '',
  avatar text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  catalog_type text not null check (catalog_type in ('school', 'pro')),
  description text not null default '',
  image_url text default '',
  teacher_profile_id uuid references public.profiles(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  audience text default '',
  duration_label text default '',
  price numeric(12,2) not null default 0,
  pricing_label text default '',
  sales_tag text default '',
  selling_points jsonb not null default '[]'::jsonb,
  release jsonb not null default '{"modules":{},"lessons":{}}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.courses add column if not exists release jsonb not null default '{"modules":{},"lessons":{}}'::jsonb;

create table if not exists public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  summary text default '',
  position integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules(id) on delete cascade,
  title text not null,
  lesson_type text not null default 'reading',
  duration_label text default '',
  content text default '',
  position integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  title text not null,
  resource_type text not null default 'link',
  url text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'removed')),
  enrolled_at timestamptz not null default now(),
  unique (course_id, profile_id)
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  module_id uuid references public.course_modules(id) on delete set null,
  lesson_id uuid references public.lessons(id) on delete set null,
  activity_type text not null check (activity_type in ('quiz', 'assignment')),
  title text not null,
  description text default '',
  due_at timestamptz,
  time_limit_minutes integer,
  attempts_allowed integer not null default 1,
  passing_score integer default 50,
  max_points integer default 20,
  weight numeric(8,2) not null default 1,
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.question_bank (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  kind text not null check (kind in ('mcq', 'truefalse', 'short', 'open')),
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  answer text default '',
  points integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_questions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  question_bank_id uuid references public.question_bank(id) on delete set null,
  kind text not null check (kind in ('mcq', 'truefalse', 'short', 'open')),
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  answer text default '',
  points integer not null default 1,
  position integer not null default 1
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'submitted' check (status in ('submitted', 'reviewed', 'graded', 'pending')),
  score numeric(8,2),
  max_points numeric(8,2),
  text_answer text default '',
  file_name text default '',
  file_url text default '',
  answers jsonb not null default '[]'::jsonb,
  feedback text default '',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.submissions add column if not exists file_url text default '';

create table if not exists public.completion_records (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  module_id uuid references public.course_modules(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (profile_id, lesson_id)
);

create table if not exists public.certificate_records (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  issued_at timestamptz not null default now(),
  progress_percent integer not null default 100,
  average_percent numeric(8,2),
  unique (course_id, profile_id)
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  author_profile_id uuid references public.profiles(id) on delete set null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  from_profile_id uuid references public.profiles(id) on delete set null,
  to_profile_id uuid references public.profiles(id) on delete cascade,
  subject text not null default '',
  content text not null,
  related_course_id uuid references public.courses(id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.forum_threads (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.forum_threads(id) on delete cascade,
  author_profile_id uuid references public.profiles(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  session_date timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('present', 'late', 'absent')),
  note text default '',
  unique (session_id, profile_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  level text not null default 'primary',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text default '',
  target_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    auth_user_id,
    full_name,
    email,
    role,
    bio,
    avatar
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'student'),
    '',
    upper(left(coalesce(new.raw_user_meta_data->>'full_name', new.email), 1))
  )
  on conflict (email) do update
    set auth_user_id = excluded.auth_user_id,
        full_name = excluded.full_name,
        role = excluded.role,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
for each row execute procedure public.touch_updated_at();

drop trigger if exists courses_touch_updated_at on public.courses;
create trigger courses_touch_updated_at before update on public.courses
for each row execute procedure public.touch_updated_at();

drop trigger if exists activities_touch_updated_at on public.activities;
create trigger activities_touch_updated_at before update on public.activities
for each row execute procedure public.touch_updated_at();

create or replace function public.current_profile_id()
returns uuid
language sql
stable
as $$
  select id
  from public.profiles
  where auth_user_id = auth.uid()
  limit 1
$$;

create or replace function public.current_profile_role()
returns text
language sql
stable
as $$
  select role
  from public.profiles
  where auth_user_id = auth.uid()
  limit 1
$$;

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_modules enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_resources enable row level security;
alter table public.enrollments enable row level security;
alter table public.activities enable row level security;
alter table public.question_bank enable row level security;
alter table public.activity_questions enable row level security;
alter table public.submissions enable row level security;
alter table public.completion_records enable row level security;
alter table public.certificate_records enable row level security;
alter table public.announcements enable row level security;
alter table public.messages enable row level security;
alter table public.forum_threads enable row level security;
alter table public.forum_posts enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "profiles read" on public.profiles;
drop policy if exists "courses read" on public.courses;
drop policy if exists "modules read" on public.course_modules;
drop policy if exists "lessons read" on public.lessons;
drop policy if exists "resources read" on public.lesson_resources;
drop policy if exists "activities read" on public.activities;
drop policy if exists "question bank read" on public.question_bank;
drop policy if exists "activity questions read" on public.activity_questions;
drop policy if exists "announcements read" on public.announcements;
drop policy if exists "forum threads read" on public.forum_threads;
drop policy if exists "forum posts read" on public.forum_posts;

create policy "service role all profiles" on public.profiles for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role all courses" on public.courses for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role all modules" on public.course_modules for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role all lessons" on public.lessons for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role all resources" on public.lesson_resources for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role all enrollments" on public.enrollments for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role all activities" on public.activities for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role all question bank" on public.question_bank for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role all activity questions" on public.activity_questions for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role all submissions" on public.submissions for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role all completion" on public.completion_records for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role all certificates" on public.certificate_records for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role all announcements" on public.announcements for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role all messages" on public.messages for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role all threads" on public.forum_threads for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role all posts" on public.forum_posts for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role all sessions" on public.attendance_sessions for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role all attendance" on public.attendance_records for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role all notifications" on public.notifications for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role all audit logs" on public.audit_logs for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "authenticated users read own profile"
on public.profiles
for select
using (auth.uid() = auth_user_id);

create policy "authenticated users update own profile"
on public.profiles
for update
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

create policy "admins read all profiles"
on public.profiles
for select
using (public.current_profile_role() = 'admin');

create policy "teachers read enrolled learners profiles"
on public.profiles
for select
using (
  public.current_profile_role() = 'teacher'
  and exists (
    select 1
    from public.enrollments e
    join public.courses c on c.id = e.course_id
    where e.profile_id = public.profiles.id
      and c.teacher_profile_id = public.current_profile_id()
      and e.status = 'active'
  )
);

create policy "published courses visible to authenticated"
on public.courses
for select
using (
  auth.role() = 'authenticated'
  and (
    public.current_profile_role() = 'admin'
    or status = 'published'
    or teacher_profile_id = public.current_profile_id()
    or exists (
      select 1
      from public.enrollments e
      where e.course_id = public.courses.id
        and e.profile_id = public.current_profile_id()
        and e.status = 'active'
    )
  )
);

create policy "admins and teachers manage courses"
on public.courses
for all
using (
  public.current_profile_role() = 'admin'
  or teacher_profile_id = public.current_profile_id()
)
with check (
  public.current_profile_role() = 'admin'
  or teacher_profile_id = public.current_profile_id()
);

create policy "visible modules by course access"
on public.course_modules
for select
using (
  exists (
    select 1
    from public.courses c
    where c.id = public.course_modules.course_id
      and (
        public.current_profile_role() = 'admin'
        or c.teacher_profile_id = public.current_profile_id()
        or c.status = 'published'
        or exists (
          select 1
          from public.enrollments e
          where e.course_id = c.id
            and e.profile_id = public.current_profile_id()
            and e.status = 'active'
        )
      )
  )
);

create policy "admins and teachers manage modules"
on public.course_modules
for all
using (
  exists (
    select 1
    from public.courses c
    where c.id = public.course_modules.course_id
      and (
        public.current_profile_role() = 'admin'
        or c.teacher_profile_id = public.current_profile_id()
      )
  )
)
with check (
  exists (
    select 1
    from public.courses c
    where c.id = public.course_modules.course_id
      and (
        public.current_profile_role() = 'admin'
        or c.teacher_profile_id = public.current_profile_id()
      )
  )
);

create policy "visible lessons by module access"
on public.lessons
for select
using (
  exists (
    select 1
    from public.course_modules m
    join public.courses c on c.id = m.course_id
    where m.id = public.lessons.module_id
      and (
        public.current_profile_role() = 'admin'
        or c.teacher_profile_id = public.current_profile_id()
        or c.status = 'published'
        or exists (
          select 1
          from public.enrollments e
          where e.course_id = c.id
            and e.profile_id = public.current_profile_id()
            and e.status = 'active'
        )
      )
  )
);

create policy "admins and teachers manage lessons"
on public.lessons
for all
using (
  exists (
    select 1
    from public.course_modules m
    join public.courses c on c.id = m.course_id
    where m.id = public.lessons.module_id
      and (
        public.current_profile_role() = 'admin'
        or c.teacher_profile_id = public.current_profile_id()
      )
  )
)
with check (
  exists (
    select 1
    from public.course_modules m
    join public.courses c on c.id = m.course_id
    where m.id = public.lessons.module_id
      and (
        public.current_profile_role() = 'admin'
        or c.teacher_profile_id = public.current_profile_id()
      )
  )
);

create policy "visible lesson resources by lesson access"
on public.lesson_resources
for select
using (
  exists (
    select 1
    from public.lessons l
    join public.course_modules m on m.id = l.module_id
    join public.courses c on c.id = m.course_id
    where l.id = public.lesson_resources.lesson_id
      and (
        public.current_profile_role() = 'admin'
        or c.teacher_profile_id = public.current_profile_id()
        or c.status = 'published'
        or exists (
          select 1
          from public.enrollments e
          where e.course_id = c.id
            and e.profile_id = public.current_profile_id()
            and e.status = 'active'
        )
      )
  )
);

create policy "admins and teachers manage lesson resources"
on public.lesson_resources
for all
using (
  exists (
    select 1
    from public.lessons l
    join public.course_modules m on m.id = l.module_id
    join public.courses c on c.id = m.course_id
    where l.id = public.lesson_resources.lesson_id
      and (
        public.current_profile_role() = 'admin'
        or c.teacher_profile_id = public.current_profile_id()
      )
  )
)
with check (
  exists (
    select 1
    from public.lessons l
    join public.course_modules m on m.id = l.module_id
    join public.courses c on c.id = m.course_id
    where l.id = public.lesson_resources.lesson_id
      and (
        public.current_profile_role() = 'admin'
        or c.teacher_profile_id = public.current_profile_id()
      )
  )
);

create policy "users view own or managed enrollments"
on public.enrollments
for select
using (
  public.current_profile_role() = 'admin'
  or profile_id = public.current_profile_id()
  or exists (
    select 1
    from public.courses c
    where c.id = public.enrollments.course_id
      and c.teacher_profile_id = public.current_profile_id()
  )
);

create policy "admins and teachers manage enrollments"
on public.enrollments
for all
using (
  public.current_profile_role() = 'admin'
  or exists (
    select 1
    from public.courses c
    where c.id = public.enrollments.course_id
      and c.teacher_profile_id = public.current_profile_id()
  )
)
with check (
  public.current_profile_role() = 'admin'
  or exists (
    select 1
    from public.courses c
    where c.id = public.enrollments.course_id
      and c.teacher_profile_id = public.current_profile_id()
  )
);

create policy "users view visible activities"
on public.activities
for select
using (
  public.current_profile_role() = 'admin'
  or created_by = public.current_profile_id()
  or exists (
    select 1
    from public.courses c
    where c.id = public.activities.course_id
      and (
        c.teacher_profile_id = public.current_profile_id()
        or exists (
          select 1
          from public.enrollments e
          where e.course_id = c.id
            and e.profile_id = public.current_profile_id()
            and e.status = 'active'
        )
      )
  )
);

create policy "admins and teachers manage activities"
on public.activities
for all
using (
  public.current_profile_role() = 'admin'
  or exists (
    select 1
    from public.courses c
    where c.id = public.activities.course_id
      and c.teacher_profile_id = public.current_profile_id()
  )
)
with check (
  public.current_profile_role() = 'admin'
  or exists (
    select 1
    from public.courses c
    where c.id = public.activities.course_id
      and c.teacher_profile_id = public.current_profile_id()
  )
);

create policy "users view question bank for managed or enrolled courses"
on public.question_bank
for select
using (
  public.current_profile_role() = 'admin'
  or exists (
    select 1
    from public.courses c
    where c.id = public.question_bank.course_id
      and (
        c.teacher_profile_id = public.current_profile_id()
        or exists (
          select 1
          from public.enrollments e
          where e.course_id = c.id
            and e.profile_id = public.current_profile_id()
            and e.status = 'active'
        )
      )
  )
);

create policy "admins and teachers manage question bank"
on public.question_bank
for all
using (
  public.current_profile_role() = 'admin'
  or exists (
    select 1
    from public.courses c
    where c.id = public.question_bank.course_id
      and c.teacher_profile_id = public.current_profile_id()
  )
)
with check (
  public.current_profile_role() = 'admin'
  or exists (
    select 1
    from public.courses c
    where c.id = public.question_bank.course_id
      and c.teacher_profile_id = public.current_profile_id()
  )
);

create policy "users view activity questions with activity access"
on public.activity_questions
for select
using (
  exists (
    select 1
    from public.activities a
    join public.courses c on c.id = a.course_id
    where a.id = public.activity_questions.activity_id
      and (
        public.current_profile_role() = 'admin'
        or c.teacher_profile_id = public.current_profile_id()
        or exists (
          select 1
          from public.enrollments e
          where e.course_id = c.id
            and e.profile_id = public.current_profile_id()
            and e.status = 'active'
        )
      )
  )
);

create policy "admins and teachers manage activity questions"
on public.activity_questions
for all
using (
  exists (
    select 1
    from public.activities a
    join public.courses c on c.id = a.course_id
    where a.id = public.activity_questions.activity_id
      and (
        public.current_profile_role() = 'admin'
        or c.teacher_profile_id = public.current_profile_id()
      )
  )
)
with check (
  exists (
    select 1
    from public.activities a
    join public.courses c on c.id = a.course_id
    where a.id = public.activity_questions.activity_id
      and (
        public.current_profile_role() = 'admin'
        or c.teacher_profile_id = public.current_profile_id()
      )
  )
);

create policy "users view own or managed submissions"
on public.submissions
for select
using (
  public.current_profile_role() = 'admin'
  or profile_id = public.current_profile_id()
  or exists (
    select 1
    from public.activities a
    join public.courses c on c.id = a.course_id
    where a.id = public.submissions.activity_id
      and c.teacher_profile_id = public.current_profile_id()
  )
);

create policy "students create own submissions"
on public.submissions
for insert
with check (
  profile_id = public.current_profile_id()
);

create policy "teachers and admins update submissions"
on public.submissions
for update
using (
  public.current_profile_role() = 'admin'
  or exists (
    select 1
    from public.activities a
    join public.courses c on c.id = a.course_id
    where a.id = public.submissions.activity_id
      and c.teacher_profile_id = public.current_profile_id()
  )
)
with check (
  public.current_profile_role() = 'admin'
  or exists (
    select 1
    from public.activities a
    join public.courses c on c.id = a.course_id
    where a.id = public.submissions.activity_id
      and c.teacher_profile_id = public.current_profile_id()
  )
);

create policy "users view own or managed completion"
on public.completion_records
for select
using (
  public.current_profile_role() = 'admin'
  or profile_id = public.current_profile_id()
  or exists (
    select 1
    from public.courses c
    where c.id = public.completion_records.course_id
      and c.teacher_profile_id = public.current_profile_id()
  )
);

create policy "students manage own completion"
on public.completion_records
for all
using (profile_id = public.current_profile_id())
with check (profile_id = public.current_profile_id());

create policy "users view own or managed certificates"
on public.certificate_records
for select
using (
  public.current_profile_role() = 'admin'
  or profile_id = public.current_profile_id()
  or exists (
    select 1
    from public.courses c
    where c.id = public.certificate_records.course_id
      and c.teacher_profile_id = public.current_profile_id()
  )
);

create policy "students manage own certificates"
on public.certificate_records
for all
using (profile_id = public.current_profile_id())
with check (profile_id = public.current_profile_id());

create policy "users view course or global announcements"
on public.announcements
for select
using (
  public.current_profile_role() = 'admin'
  or course_id is null
  or exists (
    select 1
    from public.courses c
    where c.id = public.announcements.course_id
      and (
        c.teacher_profile_id = public.current_profile_id()
        or exists (
          select 1
          from public.enrollments e
          where e.course_id = c.id
            and e.profile_id = public.current_profile_id()
            and e.status = 'active'
        )
      )
  )
);

create policy "admins and teachers manage announcements"
on public.announcements
for all
using (
  public.current_profile_role() = 'admin'
  or author_profile_id = public.current_profile_id()
)
with check (
  public.current_profile_role() = 'admin'
  or author_profile_id = public.current_profile_id()
);

create policy "users read own messages"
on public.messages
for select
using (
  public.current_profile_role() = 'admin'
  or from_profile_id = public.current_profile_id()
  or to_profile_id = public.current_profile_id()
);

create policy "authenticated users send messages"
on public.messages
for insert
with check (from_profile_id = public.current_profile_id());

create policy "users update own received messages"
on public.messages
for update
using (to_profile_id = public.current_profile_id())
with check (to_profile_id = public.current_profile_id());

create policy "users view course forums"
on public.forum_threads
for select
using (
  public.current_profile_role() = 'admin'
  or exists (
    select 1
    from public.courses c
    where c.id = public.forum_threads.course_id
      and (
        c.teacher_profile_id = public.current_profile_id()
        or exists (
          select 1
          from public.enrollments e
          where e.course_id = c.id
            and e.profile_id = public.current_profile_id()
            and e.status = 'active'
        )
      )
  )
);

create policy "authenticated users create forum threads"
on public.forum_threads
for insert
with check (created_by = public.current_profile_id());

create policy "users view course forum posts"
on public.forum_posts
for select
using (
  exists (
    select 1
    from public.forum_threads t
    join public.courses c on c.id = t.course_id
    where t.id = public.forum_posts.thread_id
      and (
        public.current_profile_role() = 'admin'
        or c.teacher_profile_id = public.current_profile_id()
        or exists (
          select 1
          from public.enrollments e
          where e.course_id = c.id
            and e.profile_id = public.current_profile_id()
            and e.status = 'active'
        )
      )
  )
);

create policy "authenticated users create forum posts"
on public.forum_posts
for insert
with check (author_profile_id = public.current_profile_id());

create policy "users view own or managed attendance sessions"
on public.attendance_sessions
for select
using (
  public.current_profile_role() = 'admin'
  or created_by = public.current_profile_id()
  or exists (
    select 1
    from public.enrollments e
    where e.course_id = public.attendance_sessions.course_id
      and e.profile_id = public.current_profile_id()
      and e.status = 'active'
  )
);

create policy "admins and teachers manage attendance sessions"
on public.attendance_sessions
for all
using (
  public.current_profile_role() = 'admin'
  or created_by = public.current_profile_id()
)
with check (
  public.current_profile_role() = 'admin'
  or created_by = public.current_profile_id()
);

create policy "users view own or managed attendance records"
on public.attendance_records
for select
using (
  public.current_profile_role() = 'admin'
  or profile_id = public.current_profile_id()
  or exists (
    select 1
    from public.attendance_sessions s
    join public.courses c on c.id = s.course_id
    where s.id = public.attendance_records.session_id
      and c.teacher_profile_id = public.current_profile_id()
  )
);

create policy "admins and teachers manage attendance records"
on public.attendance_records
for all
using (
  public.current_profile_role() = 'admin'
  or exists (
    select 1
    from public.attendance_sessions s
    join public.courses c on c.id = s.course_id
    where s.id = public.attendance_records.session_id
      and c.teacher_profile_id = public.current_profile_id()
  )
)
with check (
  public.current_profile_role() = 'admin'
  or exists (
    select 1
    from public.attendance_sessions s
    join public.courses c on c.id = s.course_id
    where s.id = public.attendance_records.session_id
      and c.teacher_profile_id = public.current_profile_id()
  )
);

create policy "users read own notifications"
on public.notifications
for select
using (
  public.current_profile_role() = 'admin'
  or profile_id = public.current_profile_id()
);

create policy "admins manage notifications"
on public.notifications
for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

create policy "admins read audit logs"
on public.audit_logs
for select
using (public.current_profile_role() = 'admin');
