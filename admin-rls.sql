-- WTW admin authorization and request-table status policies
-- Run this in Supabase SQL editor.

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.admin_profiles enable row level security;

create or replace function public.is_wtw_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = auth.uid()
      and ap.active = true
      and ap.role in ('admin', 'operator')
  );
$$;

revoke all on function public.is_wtw_admin() from public;
grant execute on function public.is_wtw_admin() to authenticated;

drop policy if exists "admin profiles self read" on public.admin_profiles;
create policy "admin profiles self read"
on public.admin_profiles
for select
using (auth.uid() = user_id);

alter table public.reservation_requests enable row level security;
alter table public.guest_list_requests enable row level security;
alter table public.ticket_requests enable row level security;

drop policy if exists "reservation requests public insert" on public.reservation_requests;
create policy "reservation requests public insert"
on public.reservation_requests
for insert
to anon, authenticated
with check (true);

drop policy if exists "reservation requests admin select" on public.reservation_requests;
create policy "reservation requests admin select"
on public.reservation_requests
for select
to authenticated
using (public.is_wtw_admin());

drop policy if exists "reservation requests admin update" on public.reservation_requests;
create policy "reservation requests admin update"
on public.reservation_requests
for update
to authenticated
using (public.is_wtw_admin())
with check (public.is_wtw_admin());

drop policy if exists "guest list requests public insert" on public.guest_list_requests;
create policy "guest list requests public insert"
on public.guest_list_requests
for insert
to anon, authenticated
with check (true);

drop policy if exists "guest list requests admin select" on public.guest_list_requests;
create policy "guest list requests admin select"
on public.guest_list_requests
for select
to authenticated
using (public.is_wtw_admin());

drop policy if exists "guest list requests admin update" on public.guest_list_requests;
create policy "guest list requests admin update"
on public.guest_list_requests
for update
to authenticated
using (public.is_wtw_admin())
with check (public.is_wtw_admin());

drop policy if exists "ticket requests public insert" on public.ticket_requests;
create policy "ticket requests public insert"
on public.ticket_requests
for insert
to anon, authenticated
with check (true);

drop policy if exists "ticket requests admin select" on public.ticket_requests;
create policy "ticket requests admin select"
on public.ticket_requests
for select
to authenticated
using (public.is_wtw_admin());

drop policy if exists "ticket requests admin update" on public.ticket_requests;
create policy "ticket requests admin update"
on public.ticket_requests
for update
to authenticated
using (public.is_wtw_admin())
with check (public.is_wtw_admin());
