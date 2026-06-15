-- WTW Partner Architecture Phase 3
-- Partner auth helpers, partner-facing read policies, and routed request read RPC.

create extension if not exists pgcrypto;

create or replace function public.is_wtw_partner_user()
returns boolean
language sql
stable
security definer
set search_path = public
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
set search_path = public
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

create or replace function public.get_partner_routed_requests()
returns table (
  assignment_id uuid,
  request_type text,
  request_id uuid,
  partner_id uuid,
  internal_status text,
  partner_status text,
  routed_at timestamptz,
  assigned_venue_id uuid,
  partner_name text,
  partner_level text,
  customer_name text,
  customer_email text,
  customer_phone text,
  market text,
  venue_name text,
  event_title text,
  requested_date date,
  requested_time text,
  arrival_time text,
  occasion text,
  party_size integer,
  quantity integer,
  ticket_type text,
  total_amount numeric(10,2),
  notes text,
  request_status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_wtw_partner_user() then
    raise exception 'WTW partner session required.' using errcode = '42501';
  end if;

  return query
    select
      ra.id as assignment_id,
      ra.request_type,
      ra.request_id,
      ra.partner_id,
      ra.internal_status,
      ra.partner_status,
      ra.routed_at,
      ra.assigned_venue_id,
      p.business_name as partner_name,
      p.partner_level,
      r.user_name as customer_name,
      r.user_email as customer_email,
      r.phone as customer_phone,
      r.market,
      r.venue_name,
      null::text as event_title,
      r.requested_date,
      r.requested_time::text as requested_time,
      null::text as arrival_time,
      r.occasion,
      r.party_size,
      null::integer as quantity,
      null::text as ticket_type,
      null::numeric(10,2) as total_amount,
      r.notes,
      r.status as request_status
    from public.request_assignments ra
    join public.partners p on p.id = ra.partner_id
    join public.reservation_requests r on r.id = ra.request_id
    where ra.request_type = 'reservation'
      and ra.partner_id = any(public.current_partner_ids())
      and ra.internal_status <> 'rerouted'

    union all

    select
      ra.id as assignment_id,
      ra.request_type,
      ra.request_id,
      ra.partner_id,
      ra.internal_status,
      ra.partner_status,
      ra.routed_at,
      ra.assigned_venue_id,
      p.business_name as partner_name,
      p.partner_level,
      g.user_name as customer_name,
      g.user_email as customer_email,
      g.phone as customer_phone,
      g.market,
      null::text as venue_name,
      g.event_title,
      null::date as requested_date,
      null::text as requested_time,
      g.arrival_time,
      null::text as occasion,
      g.party_size,
      null::integer as quantity,
      null::text as ticket_type,
      null::numeric(10,2) as total_amount,
      g.notes,
      g.status as request_status
    from public.request_assignments ra
    join public.partners p on p.id = ra.partner_id
    join public.guest_list_requests g on g.id = ra.request_id
    where ra.request_type = 'guest_list'
      and ra.partner_id = any(public.current_partner_ids())
      and ra.internal_status <> 'rerouted'

    union all

    select
      ra.id as assignment_id,
      ra.request_type,
      ra.request_id,
      ra.partner_id,
      ra.internal_status,
      ra.partner_status,
      ra.routed_at,
      ra.assigned_venue_id,
      p.business_name as partner_name,
      p.partner_level,
      t.user_name as customer_name,
      t.user_email as customer_email,
      t.phone as customer_phone,
      null::text as market,
      null::text as venue_name,
      t.event_title,
      null::date as requested_date,
      null::text as requested_time,
      null::text as arrival_time,
      null::text as occasion,
      null::integer as party_size,
      t.quantity,
      t.ticket_type,
      t.total_amount,
      null::text as notes,
      t.status as request_status
    from public.request_assignments ra
    join public.partners p on p.id = ra.partner_id
    join public.ticket_requests t on t.id = ra.request_id
    where ra.request_type = 'vip_table'
      and ra.partner_id = any(public.current_partner_ids())
      and ra.internal_status <> 'rerouted'
      and (
        lower(coalesce(t.ticket_type, '')) like '%vip%'
        or lower(coalesce(t.ticket_type, '')) like '%table%'
      )

    union all

    select
      ra.id as assignment_id,
      ra.request_type,
      ra.request_id,
      ra.partner_id,
      ra.internal_status,
      ra.partner_status,
      ra.routed_at,
      ra.assigned_venue_id,
      p.business_name as partner_name,
      p.partner_level,
      t.user_name as customer_name,
      t.user_email as customer_email,
      t.phone as customer_phone,
      null::text as market,
      null::text as venue_name,
      t.event_title,
      null::date as requested_date,
      null::text as requested_time,
      null::text as arrival_time,
      null::text as occasion,
      null::integer as party_size,
      t.quantity,
      t.ticket_type,
      t.total_amount,
      null::text as notes,
      t.status as request_status
    from public.request_assignments ra
    join public.partners p on p.id = ra.partner_id
    join public.ticket_requests t on t.id = ra.request_id
    where ra.request_type = 'ticket'
      and ra.partner_id = any(public.current_partner_ids())
      and ra.internal_status <> 'rerouted'
      and not (
        lower(coalesce(t.ticket_type, '')) like '%vip%'
        or lower(coalesce(t.ticket_type, '')) like '%table%'
      )
    order by routed_at desc;
end;
$$;

alter table public.partners enable row level security;
alter table public.partner_users enable row level security;
alter table public.request_assignments enable row level security;

drop policy if exists "partners partner select" on public.partners;
create policy "partners partner select"
on public.partners
for select
to authenticated
using (
  status in ('pending_setup', 'active')
  and exists (
    select 1
    from public.partner_users pu
    where pu.partner_id = partners.id
      and pu.user_id = auth.uid()
      and pu.active = true
  )
);

drop policy if exists "partner users partner select" on public.partner_users;
create policy "partner users partner select"
on public.partner_users
for select
to authenticated
using (
  user_id = auth.uid()
  and active = true
  and exists (
    select 1
    from public.partners p
    where p.id = partner_users.partner_id
      and p.status in ('pending_setup', 'active')
  )
);

drop policy if exists "request assignments partner select" on public.request_assignments;
create policy "request assignments partner select"
on public.request_assignments
for select
to authenticated
using (
  partner_id = any(public.current_partner_ids())
  and internal_status <> 'rerouted'
);

revoke all on function public.is_wtw_partner_user() from public;
revoke all on function public.current_partner_ids() from public;
revoke all on function public.get_partner_routed_requests() from public;

grant execute on function public.is_wtw_partner_user() to authenticated;
grant execute on function public.current_partner_ids() to authenticated;
grant execute on function public.get_partner_routed_requests() to authenticated;
