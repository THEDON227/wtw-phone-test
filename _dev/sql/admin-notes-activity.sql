-- WTW admin internal notes and activity timeline
-- Admin-only record history for operational requests.

create extension if not exists pgcrypto;

create table if not exists public.internal_notes (
  id uuid primary key default gen_random_uuid(),
  record_type text not null,
  record_id uuid not null,
  body text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint internal_notes_record_type_check
    check (record_type in ('reservation','guest_list','ticket','wave_pass','partner_application'))
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  record_type text not null,
  record_id uuid not null,
  action text not null,
  from_status text,
  to_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint activity_log_record_type_check
    check (record_type in ('reservation','guest_list','ticket','wave_pass','partner_application'))
);

create index if not exists idx_internal_notes_record on public.internal_notes (record_type, record_id, created_at desc);
create index if not exists idx_activity_log_record on public.activity_log (record_type, record_id, created_at desc);

alter table public.internal_notes enable row level security;
alter table public.activity_log enable row level security;

revoke all on table public.internal_notes from public;
revoke all on table public.activity_log from public;
grant select, insert on table public.internal_notes to authenticated;
grant select, insert on table public.activity_log to authenticated;

drop policy if exists "internal notes admin select" on public.internal_notes;
create policy "internal notes admin select"
on public.internal_notes
for select
to authenticated
using (public.is_wtw_admin());

drop policy if exists "internal notes admin insert" on public.internal_notes;
create policy "internal notes admin insert"
on public.internal_notes
for insert
to authenticated
with check (public.is_wtw_admin());

drop policy if exists "activity log admin select" on public.activity_log;
create policy "activity log admin select"
on public.activity_log
for select
to authenticated
using (public.is_wtw_admin());

drop policy if exists "activity log admin insert" on public.activity_log;
create policy "activity log admin insert"
on public.activity_log
for insert
to authenticated
with check (public.is_wtw_admin());
