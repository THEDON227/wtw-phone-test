-- WTW Partner Architecture Phase 2
-- Admin request routing to permanent partners with preserved assignment history.

create extension if not exists pgcrypto;

alter table public.request_assignments
  drop constraint if exists request_assignments_unique_active;

drop index if exists public.request_assignments_unique_active;

create unique index if not exists idx_request_assignments_active_unique
on public.request_assignments (request_type, request_id, partner_id)
where internal_status in ('sent_to_partner', 'confirmed');

create index if not exists idx_request_assignments_partner on public.request_assignments (partner_id);
create index if not exists idx_request_assignments_request on public.request_assignments (request_type, request_id);
create index if not exists idx_request_assignments_status on public.request_assignments (partner_status);
create index if not exists idx_request_assignments_routed_at on public.request_assignments (routed_at desc);

create or replace function public.route_request_to_partner(
  p_request_type text,
  p_request_id uuid,
  p_partner_id uuid,
  p_assigned_venue_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rt text := lower(trim(coalesce(p_request_type, '')));
  request_row record;
  partner_row public.partners%rowtype;
  assignment_row public.request_assignments%rowtype;
  request_status text := null;
  route_action text := 'request_routed';
  previous_assignment_ids uuid[] := '{}'::uuid[];
  previous_assignment_id uuid := null;
  previous_partner_id uuid := null;
  venue_row public.venues%rowtype;
  record_type text;
  metadata jsonb;
begin
  if not public.is_wtw_admin() then
    raise exception 'WTW admin session required.' using errcode = '42501';
  end if;

  if rt not in ('reservation', 'guest_list', 'vip_table', 'ticket') then
    raise exception 'Invalid request type.' using errcode = '22000';
  end if;

  select * into partner_row
  from public.partners
  where id = p_partner_id
  for update;

  if not found then
    raise exception 'Partner not found.' using errcode = 'P0002';
  end if;

  if partner_row.status in ('inactive', 'archived') then
    raise exception 'Partner is not eligible for routing.' using errcode = '22000';
  end if;

  if p_assigned_venue_id is not null then
    select * into venue_row
    from public.venues
    where id = p_assigned_venue_id;
    if not found then
      raise exception 'Assigned venue not found.' using errcode = 'P0002';
    end if;
  end if;

  if rt = 'reservation' then
    select * into request_row
    from public.reservation_requests
    where id = p_request_id
    for update;
    if not found then
      raise exception 'Reservation request not found.' using errcode = 'P0002';
    end if;
    request_status := 'sent_to_partner';
    record_type := 'reservation';
  elsif rt = 'guest_list' then
    select * into request_row
    from public.guest_list_requests
    where id = p_request_id
    for update;
    if not found then
      raise exception 'Guest list request not found.' using errcode = 'P0002';
    end if;
    request_status := 'reviewing';
    record_type := 'guest_list';
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
    request_status := 'sent_to_partner';
    record_type := 'ticket';
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
    request_status := null;
    record_type := 'ticket';
  end if;

  select coalesce(array_agg(id order by routed_at desc), '{}'::uuid[]),
         (array_agg(partner_id order by routed_at desc))[1]
    into previous_assignment_ids,
         previous_partner_id
  from public.request_assignments
  where request_type = rt
    and request_id = p_request_id
    and internal_status in ('sent_to_partner', 'confirmed');

  previous_assignment_id := previous_assignment_ids[1];
  if coalesce(array_length(previous_assignment_ids, 1), 0) > 0 then
    route_action := 'request_rerouted';
    update public.request_assignments
      set internal_status = 'rerouted'
    where id = any(previous_assignment_ids);
  end if;

  insert into public.request_assignments (
    request_type,
    request_id,
    partner_id,
    assigned_venue_id,
    routed_by,
    routed_at,
    internal_status,
    partner_status,
    metadata
  ) values (
    rt,
    p_request_id,
    p_partner_id,
    p_assigned_venue_id,
    auth.uid(),
    now(),
    'sent_to_partner',
    'pending_response',
    jsonb_build_object(
      'request_status_before', request_row.status,
      'request_label', record_type,
      'partner_name', partner_row.business_name,
      'assigned_venue_id', p_assigned_venue_id
    )
  )
  returning * into assignment_row;

  if request_status is not null then
    if rt = 'reservation' then
      update public.reservation_requests
        set status = request_status
      where id = p_request_id;
    elsif rt = 'guest_list' then
      update public.guest_list_requests
        set status = request_status
      where id = p_request_id;
    elsif rt = 'vip_table' or rt = 'ticket' then
      if request_status is not null then
        update public.ticket_requests
          set status = request_status
        where id = p_request_id;
      end if;
    end if;
  end if;

  insert into public.activity_log (
    record_type,
    record_id,
    action,
    from_status,
    to_status,
    metadata,
    created_by
  ) values (
    record_type,
    p_request_id,
    route_action,
    case when route_action = 'request_rerouted' then 'sent_to_partner' else null end,
    'sent_to_partner',
    case
      when route_action = 'request_rerouted' then jsonb_build_object(
        'previous_partner_id', previous_partner_id,
        'new_partner_id', p_partner_id,
        'previous_assignment_id', previous_assignment_id,
        'new_assignment_id', assignment_row.id,
        'previous_assignment_ids', previous_assignment_ids,
        'partner_name', partner_row.business_name,
        'request_type', rt,
        'assigned_venue_id', p_assigned_venue_id
      )
      else jsonb_build_object(
        'assignment_id', assignment_row.id,
        'partner_id', p_partner_id,
        'partner_name', partner_row.business_name,
        'request_type', rt,
        'assigned_venue_id', p_assigned_venue_id
      )
    end,
    auth.uid()
  );

  return jsonb_build_object(
    'assignment', to_jsonb(assignment_row),
    'partner', to_jsonb(partner_row),
    'request_status', request_status,
    'route_action', route_action,
    'previous_assignment_id', previous_assignment_id,
    'previous_partner_id', previous_partner_id,
    'previous_assignment_ids', to_jsonb(previous_assignment_ids),
    'rerouted_assignment_ids', to_jsonb(previous_assignment_ids)
  );
end;
$$;

revoke all on function public.route_request_to_partner(text, uuid, uuid, uuid) from public;
grant execute on function public.route_request_to_partner(text, uuid, uuid, uuid) to authenticated;
