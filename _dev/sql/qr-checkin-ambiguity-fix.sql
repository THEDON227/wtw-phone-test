-- WTW QR check-in ambiguity fix
-- Patch only: qualify qr_status in the update predicate to avoid PL/pgSQL ambiguity.

create or replace function public.check_in_confirmation_qr(
  p_qr_token text
)
returns table (
  qr_status text,
  display_status text,
  confirmation_reference text,
  customer_name text,
  venue_name text,
  confirmed_date date,
  confirmed_time text,
  party_size integer,
  quantity integer,
  checked_in_at timestamptz,
  scan_count integer,
  result text
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_token text := nullif(trim(coalesce(p_qr_token, '')), '');
  v_hash text;
  v_qr public.confirmation_qr_credentials%rowtype;
  v_confirmation public.customer_confirmations%rowtype;
  v_effective_status text;
  v_has_partner_access boolean := false;
begin
  if auth.uid() is null or not (public.is_wtw_admin() or public.is_wtw_partner_user()) then
    raise exception 'WTW authenticated admin or partner session required.' using errcode = '42501';
  end if;

  if v_token is null then
    return query
      select
        'invalid'::text,
        'INVALID'::text,
        null::text,
        null::text,
        null::text,
        null::date,
        null::text,
        null::integer,
        null::integer,
        null::timestamptz,
        null::integer,
        'invalid'::text;
    return;
  end if;

  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  select q.*
  into v_qr
  from public.confirmation_qr_credentials q
  where q.qr_token_hash = v_hash
  limit 1;

  if not found or v_qr.id is null then
    return query
      select
        'invalid'::text,
        'INVALID'::text,
        null::text,
        null::text,
        null::text,
        null::date,
        null::text,
        null::integer,
        null::integer,
        null::timestamptz,
        null::integer,
        'invalid'::text;
    return;
  end if;

  select c.*
  into v_confirmation
  from public.customer_confirmations c
  where c.id = v_qr.confirmation_id
  limit 1;

  if not found or v_confirmation.id is null then
    return query
      select
        'invalid'::text,
        'INVALID'::text,
        null::text,
        null::text,
        null::text,
        null::date,
        null::text,
        null::integer,
        null::integer,
        null::timestamptz,
        null::integer,
        'invalid'::text;
    return;
  end if;

  v_effective_status := case
    when v_qr.qr_status = 'active' and v_qr.expires_at is not null and v_qr.expires_at <= now() then 'expired'
    else v_qr.qr_status
  end;

  if not public.is_wtw_admin() then
    select exists (
      select 1
      from public.request_assignments ra
      where ra.request_type = v_confirmation.request_type
        and ra.request_id = v_confirmation.request_id
        and ra.internal_status <> 'rerouted'
        and ra.partner_id = any(public.current_partner_ids())
    ) into v_has_partner_access;

    if not v_has_partner_access then
      raise exception 'WTW partner session is not linked to this confirmation.' using errcode = '42501';
    end if;
  end if;

  if v_effective_status = 'active' then
    update public.confirmation_qr_credentials q
    set qr_status = 'checked_in',
        first_scanned_at = coalesce(q.first_scanned_at, now()),
        last_scanned_at = now(),
        scan_count = q.scan_count + 1,
        checked_in_at = coalesce(q.checked_in_at, now()),
        updated_at = now()
    where q.id = v_qr.id
      and q.qr_status = 'active';

    insert into public.confirmation_delivery_events (
      confirmation_id,
      delivery_id,
      channel,
      event_type,
      metadata
    )
    values (
      v_confirmation.id,
      null,
      'qr',
      'checked_in',
      jsonb_build_object(
        'qr_status', 'checked_in',
        'confirmation_reference', v_confirmation.confirmation_reference
      )
    );
  end if;

  select
    q.qr_status,
    case q.qr_status
      when 'active' then 'VALID / ACTIVE'
      when 'checked_in' then 'ALREADY CHECKED IN'
      when 'revoked' then 'REVOKED'
      when 'cancelled' then 'CANCELLED'
      when 'expired' then 'EXPIRED'
      else 'INVALID'
    end as display_status,
    c.confirmation_reference,
    c.customer_name,
    c.venue_name,
    c.confirmed_date,
    c.confirmed_time,
    c.party_size,
    c.quantity,
    q.checked_in_at,
    q.scan_count,
    case
      when v_effective_status = 'checked_in' then 'already_checked_in'
      when v_effective_status <> 'active' then v_effective_status
      else 'checked_in'
    end as result
  into
    qr_status,
    display_status,
    confirmation_reference,
    customer_name,
    venue_name,
    confirmed_date,
    confirmed_time,
    party_size,
    quantity,
    checked_in_at,
    scan_count,
    result
  from public.confirmation_qr_credentials q
  join public.customer_confirmations c on c.id = q.confirmation_id
  where q.id = v_qr.id;

  if not found then
    return query
      select
        'invalid'::text,
        'INVALID'::text,
        null::text,
        null::text,
        null::text,
        null::date,
        null::text,
        null::integer,
        null::integer,
        null::timestamptz,
        null::integer,
        'invalid'::text;
    return;
  end if;

  return next;
end;
$$;
