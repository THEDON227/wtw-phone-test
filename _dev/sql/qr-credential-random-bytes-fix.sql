-- WTW QR credential random-bytes fix
-- Patch only: make pgcrypto calls resolve reliably on Supabase.

create schema if not exists extensions;
create extension if not exists pgcrypto schema extensions;

create or replace function public.generate_confirmation_qr_credential(
  p_confirmation_id uuid default null,
  p_confirmation_reference text default null,
  p_rotate boolean default false
)
returns table (
  raw_token text,
  confirmation_reference text,
  qr_status text,
  display_status text,
  result text
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_confirmation public.customer_confirmations%rowtype;
  v_existing public.confirmation_qr_credentials%rowtype;
  v_token text;
  v_hash text;
  v_result text;
begin
  if not public.is_wtw_admin() then
    raise exception 'WTW admin session required.' using errcode = '42501';
  end if;

  if p_confirmation_id is null and nullif(trim(coalesce(p_confirmation_reference, '')), '') is null then
    raise exception 'Confirmation id or reference is required.' using errcode = '22023';
  end if;

  if p_confirmation_id is not null then
    select *
    into v_confirmation
    from public.customer_confirmations
    where id = p_confirmation_id
    limit 1;
  else
    select *
    into v_confirmation
    from public.customer_confirmations
    where confirmation_reference = trim(p_confirmation_reference)
    limit 1;
  end if;

  if not found or v_confirmation.id is null then
    raise exception 'Customer confirmation not found.' using errcode = '22023';
  end if;

  select *
  into v_existing
  from public.confirmation_qr_credentials
  where confirmation_id = v_confirmation.id
  limit 1;

  if found
    and coalesce(v_existing.qr_status, '') = 'active'
    and (v_existing.expires_at is null or v_existing.expires_at > now())
    and not coalesce(p_rotate, false) then
    return query
      select
        null::text as raw_token,
        v_confirmation.confirmation_reference,
        v_existing.qr_status,
        'ACTIVE'::text as display_status,
        'already_active'::text as result;
    return;
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  if found and v_existing.id is not null then
    update public.confirmation_qr_credentials
    set qr_token_hash = v_hash,
        qr_status = 'active',
        issued_at = now(),
        first_scanned_at = null,
        last_scanned_at = null,
        scan_count = 0,
        checked_in_at = null,
        revoked_at = null,
        expires_at = null,
        updated_at = now()
    where id = v_existing.id;
    v_result := case
      when coalesce(v_existing.qr_status, '') = 'active' and coalesce(p_rotate, false) then 'rotated'
      else 'reissued'
    end;
  else
    insert into public.confirmation_qr_credentials (
      confirmation_id,
      qr_token_hash,
      qr_status,
      issued_at,
      first_scanned_at,
      last_scanned_at,
      scan_count,
      checked_in_at,
      revoked_at,
      expires_at,
      created_at,
      updated_at
    )
    values (
      v_confirmation.id,
      v_hash,
      'active',
      now(),
      null,
      null,
      0,
      null,
      null,
      null,
      now(),
      now()
    );
    v_result := 'created';
  end if;

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
    'activated',
    jsonb_build_object(
      'result', v_result,
      'qr_status', 'active',
      'rotation_requested', coalesce(p_rotate, false)
    )
  );

  return query
    select
      v_token as raw_token,
      v_confirmation.confirmation_reference,
      'active'::text as qr_status,
      'ACTIVE'::text as display_status,
      v_result as result;
end;
$$;

create or replace function public.verify_confirmation_qr(
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
  quantity integer
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_token text := nullif(trim(coalesce(p_qr_token, '')), '');
  v_hash text;
begin
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
        null::integer;
    return;
  end if;

  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  return query
  with matched as (
    select
      case
        when q.qr_status = 'active' and q.expires_at is not null and q.expires_at <= now() then 'expired'
        else q.qr_status
      end as effective_status,
      c.confirmation_reference,
      c.customer_name,
      c.venue_name,
      c.confirmed_date,
      c.confirmed_time,
      c.party_size,
      c.quantity
    from public.confirmation_qr_credentials q
    join public.customer_confirmations c on c.id = q.confirmation_id
    where q.qr_token_hash = v_hash
    limit 1
  )
  select
    matched.effective_status as qr_status,
    case matched.effective_status
      when 'active' then 'VALID / ACTIVE'
      when 'checked_in' then 'ALREADY CHECKED IN'
      when 'revoked' then 'REVOKED'
      when 'cancelled' then 'CANCELLED'
      when 'expired' then 'EXPIRED'
      else 'INVALID'
    end as display_status,
    matched.confirmation_reference,
    matched.customer_name,
    matched.venue_name,
    matched.confirmed_date,
    matched.confirmed_time,
    matched.party_size,
    matched.quantity
  from matched
  union all
  select
    'invalid'::text,
    'INVALID'::text,
    null::text,
    null::text,
    null::text,
    null::date,
    null::text,
    null::integer,
    null::integer
  where not exists (select 1 from matched);
end;
$$;

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

  select
    q.*
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

  select
    c.*
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
    update public.confirmation_qr_credentials
    set qr_status = 'checked_in',
        first_scanned_at = coalesce(first_scanned_at, now()),
        last_scanned_at = now(),
        scan_count = scan_count + 1,
        checked_in_at = coalesce(checked_in_at, now()),
        updated_at = now()
    where id = v_qr.id
      and qr_status = 'active';

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

revoke all on function public.generate_confirmation_qr_credential(uuid, text, boolean) from public;
revoke all on function public.verify_confirmation_qr(text) from public;
revoke all on function public.check_in_confirmation_qr(text) from public;

grant execute on function public.generate_confirmation_qr_credential(uuid, text, boolean) to authenticated;
grant execute on function public.verify_confirmation_qr(text) to anon, authenticated;
grant execute on function public.check_in_confirmation_qr(text) to authenticated;
