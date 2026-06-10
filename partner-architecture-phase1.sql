-- WTW Partner Architecture Phase 1
-- Permanent partner records, partner memberships, request routing, and admin-only conversion RPC.

create extension if not exists pgcrypto;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  business_type text,
  market text,
  website text,
  instagram text,
  partner_level text,
  status text not null default 'pending_setup',
  source_application_id uuid unique references public.partner_applications(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partners_partner_level_check
    check (partner_level in ('basic', 'preferred', 'signature') or partner_level is null),
  constraint partners_status_check
    check (status in ('pending_setup', 'active', 'inactive', 'archived'))
);

create table if not exists public.partner_users (
  user_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  role text not null default 'staff',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint partner_users_pkey primary key (user_id, partner_id),
  constraint partner_users_role_check
    check (role in ('owner', 'manager', 'reservations', 'promoter', 'staff'))
);

create table if not exists public.request_assignments (
  id uuid primary key default gen_random_uuid(),
  request_type text not null,
  request_id uuid not null,
  partner_id uuid not null references public.partners(id) on delete cascade,
  assigned_venue_id uuid references public.venues(id),
  routed_at timestamptz not null default now(),
  routed_by uuid references auth.users(id),
  internal_status text not null default 'sent_to_partner',
  partner_status text not null default 'pending_response',
  partner_response_at timestamptz,
  partner_response_by uuid references auth.users(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint request_assignments_request_type_check
    check (request_type in ('reservation', 'guest_list', 'vip_table', 'ticket')),
  constraint request_assignments_internal_status_check
    check (internal_status in ('sent_to_partner', 'confirmed', 'declined', 'completed', 'rerouted')),
  constraint request_assignments_partner_status_check
    check (partner_status in ('pending_response', 'accepted', 'declined', 'alternative_suggested', 'completed')),
  constraint request_assignments_unique_active
    unique (request_type, request_id, partner_id)
);

create index if not exists idx_partners_market on public.partners (market, created_at desc);
create index if not exists idx_partners_status on public.partners (status);
create index if not exists idx_partners_source_application on public.partners (source_application_id);
create index if not exists idx_partner_users_partner on public.partner_users (partner_id);
create index if not exists idx_partner_users_user on public.partner_users (user_id);
create index if not exists idx_request_assignments_partner on public.request_assignments (partner_id);
create index if not exists idx_request_assignments_request on public.request_assignments (request_type, request_id);
create index if not exists idx_request_assignments_status on public.request_assignments (partner_status);
create index if not exists idx_request_assignments_routed_at on public.request_assignments (routed_at desc);

drop trigger if exists set_partners_updated_at on public.partners;
create trigger set_partners_updated_at
before update on public.partners
for each row execute function public.touch_updated_at();

drop trigger if exists set_request_assignments_updated_at on public.request_assignments;
create trigger set_request_assignments_updated_at
before update on public.request_assignments
for each row execute function public.touch_updated_at();

alter table public.partners enable row level security;
alter table public.partner_users enable row level security;
alter table public.request_assignments enable row level security;

revoke all on table public.partners from public;
revoke all on table public.partner_users from public;
revoke all on table public.request_assignments from public;

grant select, insert, update on table public.partners to authenticated;
grant select, insert, update on table public.partner_users to authenticated;
grant select, insert, update on table public.request_assignments to authenticated;

drop policy if exists "partners admin select" on public.partners;
create policy "partners admin select"
on public.partners
for select
to authenticated
using (public.is_wtw_admin());

drop policy if exists "partners admin insert" on public.partners;
create policy "partners admin insert"
on public.partners
for insert
to authenticated
with check (public.is_wtw_admin());

drop policy if exists "partners admin update" on public.partners;
create policy "partners admin update"
on public.partners
for update
to authenticated
using (public.is_wtw_admin())
with check (public.is_wtw_admin());

drop policy if exists "partner users admin select" on public.partner_users;
create policy "partner users admin select"
on public.partner_users
for select
to authenticated
using (public.is_wtw_admin());

drop policy if exists "partner users admin insert" on public.partner_users;
create policy "partner users admin insert"
on public.partner_users
for insert
to authenticated
with check (public.is_wtw_admin());

drop policy if exists "partner users admin update" on public.partner_users;
create policy "partner users admin update"
on public.partner_users
for update
to authenticated
using (public.is_wtw_admin())
with check (public.is_wtw_admin());

drop policy if exists "request assignments admin select" on public.request_assignments;
create policy "request assignments admin select"
on public.request_assignments
for select
to authenticated
using (public.is_wtw_admin());

drop policy if exists "request assignments admin insert" on public.request_assignments;
create policy "request assignments admin insert"
on public.request_assignments
for insert
to authenticated
with check (public.is_wtw_admin());

drop policy if exists "request assignments admin update" on public.request_assignments;
create policy "request assignments admin update"
on public.request_assignments
for update
to authenticated
using (public.is_wtw_admin())
with check (public.is_wtw_admin());

create or replace function public.convert_partner_application(p_application_id uuid)
returns public.partners
language plpgsql
security definer
set search_path = public
as $$
declare
  app_row public.partner_applications%rowtype;
  partner_row public.partners%rowtype;
begin
  if not public.is_wtw_admin() then
    raise exception 'WTW admin session required.' using errcode = '42501';
  end if;

  select *
  into app_row
  from public.partner_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Partner application not found.' using errcode = 'P0002';
  end if;

  select *
  into partner_row
  from public.partners
  where source_application_id = p_application_id;

  if found then
    update public.partner_applications
      set status = 'converted'
    where id = p_application_id;
    if app_row.status <> 'converted' then
      insert into public.activity_log (
        record_type,
        record_id,
        action,
        from_status,
        to_status,
        metadata,
        created_by
      ) values (
        'partner_application',
        p_application_id,
        'partner_converted',
        app_row.status,
        'converted',
        jsonb_build_object(
          'partner_id', partner_row.id,
          'business_name', partner_row.business_name,
          'partner_level', partner_row.partner_level
        ),
        auth.uid()
      ) on conflict do nothing;
    end if;
    return partner_row;
  end if;

  if app_row.status <> 'approved' then
    raise exception 'Only approved partner applications can be converted.' using errcode = '22000';
  end if;

  if app_row.partner_level is null or app_row.partner_level not in ('basic', 'preferred', 'signature') then
    raise exception 'Partner level must be assigned before conversion.' using errcode = '22000';
  end if;

  insert into public.partners (
    business_name,
    business_type,
    market,
    website,
    instagram,
    partner_level,
    status,
    source_application_id
  ) values (
    app_row.business_name,
    app_row.business_type,
    app_row.market,
    app_row.website,
    app_row.instagram,
    app_row.partner_level,
    'pending_setup',
    app_row.id
  )
  on conflict (source_application_id) do update
    set updated_at = now()
  returning * into partner_row;

  update public.partner_applications
    set status = 'converted'
  where id = p_application_id;

  if app_row.status <> 'converted' then
    insert into public.activity_log (
      record_type,
      record_id,
      action,
      from_status,
      to_status,
      metadata,
      created_by
    ) values (
      'partner_application',
      p_application_id,
      'partner_converted',
      app_row.status,
      'converted',
      jsonb_build_object(
        'partner_id', partner_row.id,
        'business_name', partner_row.business_name,
        'partner_level', partner_row.partner_level
      ),
      auth.uid()
    );
  end if;

  return partner_row;
end;
$$;

revoke all on function public.convert_partner_application(uuid) from public;
grant execute on function public.convert_partner_application(uuid) to authenticated;
