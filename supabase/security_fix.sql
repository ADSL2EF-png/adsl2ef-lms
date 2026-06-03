-- ADSL-2EF Supabase security fix
-- Run this in Supabase SQL Editor to resolve "Table publicly accessible"
-- warnings caused by public tables without Row Level Security.

create table if not exists public.lms_state (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

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
alter table public.lms_state enable row level security;

drop policy if exists "service role all lms state" on public.lms_state;
create policy "service role all lms state"
on public.lms_state
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

revoke all on public.lms_state from anon;
revoke all on public.lms_state from authenticated;
grant all on public.lms_state to service_role;
