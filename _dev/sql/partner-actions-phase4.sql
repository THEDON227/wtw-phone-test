-- WTW Partner Portal Phase 4
-- Partner response RPC and partner-safe routed request read enhancement.

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
  metadata jsonb,
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
      ra.metadata,
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
      ra.metadata,
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
      ra.metadata,
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
      ra.metadata,
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

create or replace function public.respond_to_partner_assignment(
  p_assignment_id uuid,
  p_action text,
  p_alternative_note text default null
)
returns public.request_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  assignment_row public.request_assignments%rowtype;
  partner_row public.partners%rowtype;
  action_value text := lower(trim(coalesce(p_action, '')));
  note_value text := nullif(trim(coalesce(p_alternative_note, '')), '');
  current_status text;
  next_status text;
  record_type_value text;
  response_label text;
begin
  if auth.uid() is null or not public.is_wtw_partner_user() then
    raise exception 'WTW partner session required.' using errcode = '42501';
  end if;

  select *
  into assignment_row
  from public.request_assignments
  where id = p_assignment_id
  for update;

  if not found then
    raise exception 'WTW assignment not found.' using errcode = 'P0002';
  end if;

  if assignment_row.internal_status = 'rerouted' then
    raise exception 'WTW assignment is no longer active.' using errcode = '42501';
  end if;

  if not public.user_belongs_to_partner(assignment_row.partner_id) then
    raise exception 'WTW partner assignment access denied.' using errcode = '42501';
  end if;

  select *
  into partner_row
  from public.partners
  where id = assignment_row.partner_id;

  if not found then
    raise exception 'WTW partner not found.' using errcode = 'P0002';
  end if;

  if partner_row.status not in ('pending_setup', 'active') then
    raise exception 'WTW partner is not active.' using errcode = '42501';
  end if;

  current_status := lower(trim(coalesce(assignment_row.partner_status, '')));
  record_type_value := case
    when assignment_row.request_type = 'reservation' then 'reservation'
    when assignment_row.request_type = 'guest_list' then 'guest_list'
    else 'ticket'
  end;

  if action_value = 'accept' then
    if current_status not in ('pending_response', 'alternative_suggested') then
      raise exception 'WTW partner response transition not allowed.' using errcode = '42501';
    end if;
    next_status := 'accepted';
    response_label := 'accepted';
  elsif action_value = 'decline' then
    if current_status not in ('pending_response', 'alternative_suggested') then
      raise exception 'WTW partner response transition not allowed.' using errcode = '42501';
    end if;
    next_status := 'declined';
    response_label := 'declined';
  elsif action_value = 'suggest_alternative' then
    if current_status <> 'pending_response' then
      raise exception 'WTW partner response transition not allowed.' using errcode = '42501';
    end if;
    if note_value is null then
      raise exception 'WTW alternative note is required.' using errcode = '42501';
    end if;
    next_status := 'alternative_suggested';
    response_label := 'alternative_suggested';
    assignment_row.metadata := coalesce(assignment_row.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'partner_alternative_note', note_value,
        'partner_response_action', action_value
      );
  elsif action_value = 'update_alternative' then
    if current_status <> 'alternative_suggested' then
      raise exception 'WTW partner response transition not allowed.' using errcode = '42501';
    end if;
    if note_value is null then
      raise exception 'WTW alternative note is required.' using errcode = '42501';
    end if;
    next_status := 'alternative_suggested';
    response_label := 'alternative_suggested';
    assignment_row.metadata := coalesce(assignment_row.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'partner_alternative_note', note_value,
        'partner_response_action', action_value
      );
  elsif action_value = 'mark_completed' then
    if current_status <> 'accepted' then
      raise exception 'WTW partner response transition not allowed.' using errcode = '42501';
    end if;
    next_status := 'completed';
    response_label := 'completed';
  else
    raise exception 'WTW partner response action is not allowed.' using errcode = '42501';
  end if;

  update public.request_assignments
  set
    partner_status = next_status,
    partner_response_at = now(),
    partner_response_by = auth.uid(),
    metadata = assignment_row.metadata,
    updated_at = now()
  where id = assignment_row.id
  returning *
  into assignment_row;

  insert into public.activity_log (
    record_type,
    record_id,
    action,
    from_status,
    to_status,
    metadata,
    created_by
  )
  values (
    record_type_value,
    assignment_row.request_id,
    'partner_response',
    nullif(current_status, ''),
    next_status,
    jsonb_build_object(
      'assignment_id', assignment_row.id,
      'partner_id', assignment_row.partner_id,
      'partner_name', partner_row.business_name,
      'response', response_label,
      'response_action', action_value,
      'request_type', assignment_row.request_type
    )
    || case
      when note_value is not null then jsonb_build_object('alternative_note', note_value)
      else '{}'::jsonb
    end,
    auth.uid()
  );

  return assignment_row;
end;
$$;

revoke all on function public.user_belongs_to_partner(uuid) from public;
revoke all on function public.is_wtw_partner_user() from public;
revoke all on function public.current_partner_ids() from public;
revoke all on function public.get_partner_routed_requests() from public;
revoke all on function public.respond_to_partner_assignment(uuid, text, text) from public;

grant execute on function public.user_belongs_to_partner(uuid) to authenticated;
grant execute on function public.is_wtw_partner_user() to authenticated;
grant execute on function public.current_partner_ids() to authenticated;
grant execute on function public.get_partner_routed_requests() to authenticated;
grant execute on function public.respond_to_partner_assignment(uuid, text, text) to authenticated;
