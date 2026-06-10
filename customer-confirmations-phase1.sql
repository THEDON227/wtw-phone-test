-- WTW Customer Confirmations Phase 1
-- Permanent customer confirmation records and secure customer token lookup.

create extension if not exists pgcrypto;

create table if not exists public.customer_confirmations (
  id uuid primary key default gen_random_uuid(),
  confirmation_reference text unique not null,
  access_token uuid unique not null default gen_random_uuid(),
  request_type text not null,
  request_id uuid not null,
  assignment_id uuid references public.request_assignments(id),
  customer_name text not null,
  customer_email text,
  customer_phone text,
  market text,
  venue_name text,
  event_title text,
  confirmed_date date,
  confirmed_time text,
  party_size integer,
  quantity integer,
  ticket_type text,
  total_amount numeric(10,2),
  confirmation_status text not null default 'confirmed',
  customer_message text,
  access_instructions text,
  support_notes text,
  confirmed_by uuid references auth.users(id),
  confirmed_at timestamptz not null default now(),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_confirmations_request_type_check check (request_type in ('reservation', 'guest_list', 'vip_table', 'ticket')),
  constraint customer_confirmations_status_check check (confirmation_status in ('confirmed', 'updated', 'cancelled', 'completed'))
);

create unique index if not exists idx_customer_confirmations_request_unique
  on public.customer_confirmations (request_type, request_id);

create index if not exists idx_customer_confirmations_access_token
  on public.customer_confirmations (access_token);

create index if not exists idx_customer_confirmations_assignment_id
  on public.customer_confirmations (assignment_id);

create index if not exists idx_customer_confirmations_status
  on public.customer_confirmations (confirmation_status);

create index if not exists idx_customer_confirmations_confirmed_at
  on public.customer_confirmations (confirmed_at desc);

create or replace function public.customer_confirmations_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists customer_confirmations_updated_at on public.customer_confirmations;
create trigger customer_confirmations_updated_at
before update on public.customer_confirmations
for each row execute function public.customer_confirmations_set_updated_at();

alter table public.customer_confirmations enable row level security;

drop policy if exists "customer confirmations admin select" on public.customer_confirmations;
drop policy if exists "customer confirmations admin insert" on public.customer_confirmations;
drop policy if exists "customer confirmations admin update" on public.customer_confirmations;

create policy "customer confirmations admin select"
on public.customer_confirmations
for select
to authenticated
using (public.is_wtw_admin());

create policy "customer confirmations admin insert"
on public.customer_confirmations
for insert
to authenticated
with check (public.is_wtw_admin());

create policy "customer confirmations admin update"
on public.customer_confirmations
for update
to authenticated
using (public.is_wtw_admin())
with check (public.is_wtw_admin());

revoke all on public.customer_confirmations from public;
revoke all on public.customer_confirmations from anon;
grant select, insert, update on public.customer_confirmations to authenticated;

create or replace function public.confirm_customer_request(
  p_request_type text,
  p_request_id uuid,
  p_assignment_id uuid default null,
  p_confirmed_date date default null,
  p_confirmed_time text default null,
  p_customer_message text default null,
  p_access_instructions text default null,
  p_support_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rt text := lower(trim(coalesce(p_request_type, '')));
  request_row record;
  assignment_row record;
  existing_row public.customer_confirmations%rowtype;
  confirmation_row public.customer_confirmations%rowtype;
  event_row record;
  confirmation_id uuid := gen_random_uuid();
  confirmation_reference text;
  response_status text := 'confirmed';
  activity_action text := 'customer_confirmed';
  source_status text := null;
  source_record_type text;
  final_assignment_id uuid := null;
  v_customer_name text;
  v_customer_email text;
  v_customer_phone text;
  v_market text;
  v_venue_name text;
  v_event_title text;
  v_confirmed_date date;
  v_confirmed_time text;
  v_party_size integer;
  v_quantity integer;
  v_ticket_type text;
  v_total_amount numeric(10,2);
  p_message text := nullif(trim(coalesce(p_customer_message, '')), '');
  p_instructions text := nullif(trim(coalesce(p_access_instructions, '')), '');
  p_support text := nullif(trim(coalesce(p_support_notes, '')), '');
  partner_status text;
  assignment_internal_status text;
  has_event boolean := false;
begin
  if not public.is_wtw_admin() then
    raise exception 'WTW admin session required.' using errcode = '42501';
  end if;

  confirmation_reference := 'WTW-C-' || upper(substr(replace(confirmation_id::text, '-', ''), 1, 8));

  if rt not in ('reservation', 'guest_list', 'vip_table', 'ticket') then
    raise exception 'Invalid request type.' using errcode = '22000';
  end if;

  if rt = 'reservation' then
    select * into request_row
    from public.reservation_requests
    where id = p_request_id
    for update;
    if not found then
      raise exception 'Reservation request not found.' using errcode = 'P0002';
    end if;
    source_record_type := 'reservation';
    v_customer_name := coalesce(nullif(trim(request_row.user_name), ''), 'Guest');
    v_customer_email := nullif(trim(coalesce(request_row.user_email, '')), '');
    v_customer_phone := nullif(trim(coalesce(request_row.phone, '')), '');
    v_market := nullif(trim(coalesce(request_row.market, '')), '');
    v_venue_name := nullif(trim(coalesce(request_row.venue_name, '')), '');
    v_confirmed_date := coalesce(p_confirmed_date, request_row.requested_date);
    v_confirmed_time := coalesce(nullif(trim(coalesce(p_confirmed_time, '')), ''), nullif(trim(coalesce(request_row.requested_time, '')), ''));
    v_party_size := request_row.party_size;
  elsif rt = 'guest_list' then
    select * into request_row
    from public.guest_list_requests
    where id = p_request_id
    for update;
    if not found then
      raise exception 'Guest list request not found.' using errcode = 'P0002';
    end if;
    if request_row.event_id is not null then
      select * into event_row
      from public.events
      where id = request_row.event_id;
      has_event := found;
    else
      has_event := false;
    end if;
    source_record_type := 'guest_list';
    v_customer_name := coalesce(nullif(trim(request_row.user_name), ''), 'Guest');
    v_customer_email := nullif(trim(coalesce(request_row.user_email, '')), '');
    v_customer_phone := nullif(trim(coalesce(request_row.phone, '')), '');
    v_market := nullif(trim(coalesce(request_row.market, '')), '');
    v_venue_name := null;
    v_event_title := nullif(trim(coalesce(request_row.event_title, '')), '');
    v_confirmed_date := p_confirmed_date;
    v_confirmed_time := coalesce(nullif(trim(coalesce(p_confirmed_time, '')), ''), nullif(trim(coalesce(request_row.arrival_time, '')), ''));
    if has_event then
      v_market := nullif(trim(coalesce(request_row.market, coalesce(event_row.market, ''))), '');
      v_venue_name := nullif(trim(coalesce(event_row.venue_name, '')), '');
      v_event_title := coalesce(nullif(trim(coalesce(request_row.event_title, '')), ''), nullif(trim(coalesce(event_row.title, '')), ''));
      v_confirmed_date := coalesce(p_confirmed_date, event_row.event_date::date);
      v_confirmed_time := coalesce(nullif(trim(coalesce(p_confirmed_time, '')), ''), nullif(trim(coalesce(request_row.arrival_time, '')), ''), nullif(trim(coalesce(event_row.start_time::text, '')), ''));
    end if;
    v_party_size := request_row.party_size;
  elsif rt = 'vip_table' then
    select * into request_row
    from public.ticket_requests
    where id = p_request_id
    for update;
    if not found then
      raise exception 'VIP table request not found.' using errcode = 'P0002';
    end if;
    if not (
      lower(coalesce(request_row.ticket_type, '')) like '%vip%'
      or lower(coalesce(request_row.ticket_type, '')) like '%table%'
    ) then
      raise exception 'Use request type ticket for general admission rows.' using errcode = '22000';
    end if;
    if request_row.event_id is not null then
      select * into event_row
      from public.events
      where id = request_row.event_id;
      has_event := found;
    else
      has_event := false;
    end if;
    source_record_type := 'ticket';
    v_customer_name := coalesce(nullif(trim(request_row.user_name), ''), 'Guest');
    v_customer_email := nullif(trim(coalesce(request_row.user_email, '')), '');
    v_customer_phone := nullif(trim(coalesce(request_row.phone, '')), '');
    v_market := nullif(trim(coalesce(request_row.market, '')), '');
    v_venue_name := null;
    v_event_title := nullif(trim(coalesce(request_row.event_title, '')), '');
    v_confirmed_date := p_confirmed_date;
    v_confirmed_time := nullif(trim(coalesce(p_confirmed_time, '')), '');
    if has_event then
      v_market := nullif(trim(coalesce(request_row.market, coalesce(event_row.market, ''))), '');
      v_venue_name := nullif(trim(coalesce(event_row.venue_name, '')), '');
      v_event_title := coalesce(nullif(trim(coalesce(request_row.event_title, '')), ''), nullif(trim(coalesce(event_row.title, '')), ''));
      v_confirmed_date := coalesce(p_confirmed_date, event_row.event_date::date);
      v_confirmed_time := coalesce(nullif(trim(coalesce(p_confirmed_time, '')), ''), nullif(trim(coalesce(event_row.start_time::text, '')), ''));
    end if;
    v_quantity := request_row.quantity;
    v_ticket_type := nullif(trim(coalesce(request_row.ticket_type, '')), '');
    v_total_amount := request_row.total_amount;
  else
    select * into request_row
    from public.ticket_requests
    where id = p_request_id
    for update;
    if not found then
      raise exception 'Ticket request not found.' using errcode = 'P0002';
    end if;
    if lower(coalesce(request_row.ticket_type, '')) like '%vip%'
      or lower(coalesce(request_row.ticket_type, '')) like '%table%' then
      raise exception 'Use request type vip_table for VIP or table rows.' using errcode = '22000';
    end if;
    if request_row.event_id is not null then
      select * into event_row
      from public.events
      where id = request_row.event_id;
      has_event := found;
    else
      has_event := false;
    end if;
    source_record_type := 'ticket';
    v_customer_name := coalesce(nullif(trim(request_row.user_name), ''), 'Guest');
    v_customer_email := nullif(trim(coalesce(request_row.user_email, '')), '');
    v_customer_phone := nullif(trim(coalesce(request_row.phone, '')), '');
    v_market := nullif(trim(coalesce(request_row.market, '')), '');
    v_venue_name := null;
    v_event_title := nullif(trim(coalesce(request_row.event_title, '')), '');
    v_confirmed_date := p_confirmed_date;
    v_confirmed_time := nullif(trim(coalesce(p_confirmed_time, '')), '');
    if has_event then
      v_market := nullif(trim(coalesce(request_row.market, coalesce(event_row.market, ''))), '');
      v_venue_name := nullif(trim(coalesce(event_row.venue_name, '')), '');
      v_event_title := coalesce(nullif(trim(coalesce(request_row.event_title, '')), ''), nullif(trim(coalesce(event_row.title, '')), ''));
      v_confirmed_date := coalesce(p_confirmed_date, event_row.event_date::date);
      v_confirmed_time := coalesce(nullif(trim(coalesce(p_confirmed_time, '')), ''), nullif(trim(coalesce(event_row.start_time::text, '')), ''));
    end if;
    v_quantity := request_row.quantity;
    v_ticket_type := nullif(trim(coalesce(request_row.ticket_type, '')), '');
    v_total_amount := request_row.total_amount;
  end if;

  source_status := request_row.status;

  if p_assignment_id is not null then
    select * into assignment_row
    from public.request_assignments
    where id = p_assignment_id
    for update;
    if not found then
      raise exception 'Assignment not found.' using errcode = 'P0002';
    end if;
  else
    select * into assignment_row
    from public.request_assignments
    where request_type = rt
      and request_id = p_request_id
      and internal_status in ('sent_to_partner', 'confirmed')
    order by routed_at desc
    limit 1
    for update;
    if not found then
      raise exception 'A routed partner assignment is required before confirming the customer.' using errcode = '22000';
    end if;
  end if;

  if lower(coalesce(assignment_row.request_type, '')) <> rt
    or assignment_row.request_id <> p_request_id then
    raise exception 'Assignment does not match the request.' using errcode = '22000';
  end if;

  partner_status := lower(trim(coalesce(assignment_row.partner_status, '')));
  assignment_internal_status := lower(trim(coalesce(assignment_row.internal_status, '')));

  if assignment_internal_status = 'rerouted' then
    raise exception 'Rerouted assignments cannot be confirmed.' using errcode = '22000';
  end if;

  if partner_status not in ('accepted', 'alternative_suggested', 'completed') then
    raise exception 'Partner assignment must be accepted or resolved before final confirmation.' using errcode = '22000';
  end if;

  final_assignment_id := assignment_row.id;

  select *
    into existing_row
  from public.customer_confirmations
  where request_type = rt
    and request_id = p_request_id
  order by updated_at desc
  limit 1
  for update;

  if found then
    response_status := 'updated';
    activity_action := 'customer_confirmation_updated';
    update public.customer_confirmations
      set
        assignment_id = final_assignment_id,
        customer_name = v_customer_name,
        customer_email = v_customer_email,
        customer_phone = v_customer_phone,
        market = v_market,
        venue_name = v_venue_name,
        event_title = v_event_title,
        confirmed_date = v_confirmed_date,
        confirmed_time = v_confirmed_time,
        party_size = v_party_size,
        quantity = v_quantity,
        ticket_type = v_ticket_type,
        total_amount = v_total_amount,
        confirmation_status = response_status,
        customer_message = p_message,
        access_instructions = p_instructions,
        support_notes = p_support,
        confirmed_by = auth.uid(),
        confirmed_at = now()
      where id = existing_row.id
      returning * into confirmation_row;
  else
    insert into public.customer_confirmations (
      id,
      confirmation_reference,
      access_token,
      request_type,
      request_id,
      assignment_id,
      customer_name,
      customer_email,
      customer_phone,
      market,
      venue_name,
      event_title,
      confirmed_date,
      confirmed_time,
      party_size,
      quantity,
      ticket_type,
      total_amount,
      confirmation_status,
      customer_message,
      access_instructions,
      support_notes,
      confirmed_by,
      confirmed_at
    ) values (
      confirmation_id,
      confirmation_reference,
      gen_random_uuid(),
      rt,
      p_request_id,
      final_assignment_id,
      v_customer_name,
      v_customer_email,
      v_customer_phone,
      v_market,
      v_venue_name,
      v_event_title,
      v_confirmed_date,
      v_confirmed_time,
      v_party_size,
      v_quantity,
      v_ticket_type,
      v_total_amount,
      response_status,
      p_message,
      p_instructions,
      p_support,
      auth.uid(),
      now()
    )
    returning * into confirmation_row;
  end if;

  if rt = 'reservation' then
    update public.reservation_requests set status = 'confirmed' where id = p_request_id;
  elsif rt = 'guest_list' then
    update public.guest_list_requests set status = 'confirmed' where id = p_request_id;
  elsif rt = 'vip_table' or rt = 'ticket' then
    update public.ticket_requests set status = 'confirmed' where id = p_request_id;
  end if;

  update public.request_assignments
    set internal_status = 'confirmed'
  where id = final_assignment_id
    and lower(trim(coalesce(internal_status, ''))) <> 'rerouted';

  insert into public.activity_log (
    record_type,
    record_id,
    action,
    from_status,
    to_status,
    metadata,
    created_by
  ) values (
    source_record_type,
    p_request_id,
    activity_action,
    source_status,
    response_status,
    jsonb_build_object(
      'confirmation_id', confirmation_row.id,
      'confirmation_reference', confirmation_row.confirmation_reference,
      'assignment_id', final_assignment_id,
      'request_type', rt
    ),
    auth.uid()
  );

  return to_jsonb(confirmation_row);
end;
$$;

create or replace function public.get_customer_confirmation(p_access_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  confirmation_row public.customer_confirmations%rowtype;
begin
  select *
    into confirmation_row
  from public.customer_confirmations
  where access_token = p_access_token
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'confirmation_reference', confirmation_row.confirmation_reference,
    'request_type', confirmation_row.request_type,
    'customer_name', confirmation_row.customer_name,
    'market', confirmation_row.market,
    'venue_name', confirmation_row.venue_name,
    'event_title', confirmation_row.event_title,
    'confirmed_date', confirmation_row.confirmed_date,
    'confirmed_time', confirmation_row.confirmed_time,
    'party_size', confirmation_row.party_size,
    'quantity', confirmation_row.quantity,
    'ticket_type', confirmation_row.ticket_type,
    'total_amount', confirmation_row.total_amount,
    'confirmation_status', confirmation_row.confirmation_status,
    'customer_message', confirmation_row.customer_message,
    'access_instructions', confirmation_row.access_instructions,
    'confirmed_at', confirmation_row.confirmed_at
  );
end;
$$;

revoke all on function public.confirm_customer_request(text, uuid, uuid, date, text, text, text, text) from public;
revoke all on function public.get_customer_confirmation(uuid) from public;
grant execute on function public.confirm_customer_request(text, uuid, uuid, date, text, text, text, text) to authenticated;
grant execute on function public.get_customer_confirmation(uuid) to anon, authenticated;
