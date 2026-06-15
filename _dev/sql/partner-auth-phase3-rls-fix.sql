-- WTW Partner Auth Phase 3 RLS Fix
-- Corrects recursive partner-facing SELECT policy evaluation without changing data.

create extension if not exists pgcrypto;

create or replace function public.user_belongs_to_partner(p_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.partner_users pu
    join public.partners p on p.id = pu.partner_id
    where pu.user_id = auth.uid()
      and pu.active = true
      and pu.partner_id = p_partner_id
      and p.status in ('pending_setup', 'active')
  );
$$;

create or replace function public.is_wtw_partner_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.partner_users pu
    join public.partners p on p.id = pu.partner_id
    where pu.user_id = auth.uid()
      and pu.active = true
      and p.status in ('pending_setup', 'active')
  );
$$;

create or replace function public.current_partner_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    array(
      select distinct pu.partner_id
      from public.partner_users pu
      join public.partners p on p.id = pu.partner_id
      where pu.user_id = auth.uid()
        and pu.active = true
        and p.status in ('pending_setup', 'active')
      order by pu.partner_id
    ),
    '{}'::uuid[]
  );
$$;

revoke all on function public.user_belongs_to_partner(uuid) from public;
revoke all on function public.is_wtw_partner_user() from public;
revoke all on function public.current_partner_ids() from public;

grant execute on function public.user_belongs_to_partner(uuid) to authenticated;
grant execute on function public.is_wtw_partner_user() to authenticated;
grant execute on function public.current_partner_ids() to authenticated;

drop policy if exists "partners partner select" on public.partners;
create policy "partners partner select"
on public.partners
for select
to authenticated
using (
  public.is_wtw_admin()
  or public.user_belongs_to_partner(id)
);

drop policy if exists "partner users partner select" on public.partner_users;
create policy "partner users partner select"
on public.partner_users
for select
to authenticated
using (
  public.is_wtw_admin()
  or user_id = auth.uid()
);

drop policy if exists "request assignments partner select" on public.request_assignments;
create policy "request assignments partner select"
on public.request_assignments
for select
to authenticated
using (
  public.is_wtw_admin()
  or public.user_belongs_to_partner(partner_id)
);
