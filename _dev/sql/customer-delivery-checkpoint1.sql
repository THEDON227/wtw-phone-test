-- WTW Customer Delivery System
-- Checkpoint 1: delivery data foundation only.
-- No providers, no Edge Functions, no QR generation, no wallet signing.

create extension if not exists pgcrypto;

create table if not exists public.confirmation_deliveries (
  id uuid primary key default gen_random_uuid(),
  confirmation_id uuid not null references public.customer_confirmations(id) on delete cascade,
  channel text not null,
  provider text,
  destination text,
  delivery_status text not null default 'pending',
  provider_message_id text,
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint confirmation_deliveries_channel_check check (channel in ('email', 'sms', 'qr', 'apple_wallet')),
  constraint confirmation_deliveries_status_check check (delivery_status in ('pending', 'processing', 'sent', 'delivered', 'failed', 'skipped', 'active', 'revoked', 'not_configured'))
);

create unique index if not exists idx_confirmation_deliveries_confirmation_channel
  on public.confirmation_deliveries (confirmation_id, channel);

create index if not exists idx_confirmation_deliveries_confirmation_id
  on public.confirmation_deliveries (confirmation_id);

create index if not exists idx_confirmation_deliveries_channel_status
  on public.confirmation_deliveries (channel, delivery_status);

create index if not exists idx_confirmation_deliveries_created_at
  on public.confirmation_deliveries (created_at desc);

create table if not exists public.confirmation_qr_credentials (
  id uuid primary key default gen_random_uuid(),
  confirmation_id uuid unique not null references public.customer_confirmations(id) on delete cascade,
  qr_token_hash text unique not null,
  qr_status text not null default 'active',
  issued_at timestamptz not null default now(),
  first_scanned_at timestamptz,
  last_scanned_at timestamptz,
  scan_count integer not null default 0,
  checked_in_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint confirmation_qr_credentials_status_check check (qr_status in ('active', 'checked_in', 'revoked', 'expired', 'cancelled'))
);

create index if not exists idx_confirmation_qr_credentials_confirmation_id
  on public.confirmation_qr_credentials (confirmation_id);

create index if not exists idx_confirmation_qr_credentials_qr_token_hash
  on public.confirmation_qr_credentials (qr_token_hash);

create index if not exists idx_confirmation_qr_credentials_qr_status
  on public.confirmation_qr_credentials (qr_status);

create index if not exists idx_confirmation_qr_credentials_expires_at
  on public.confirmation_qr_credentials (expires_at);

create table if not exists public.confirmation_delivery_events (
  id uuid primary key default gen_random_uuid(),
  confirmation_id uuid not null references public.customer_confirmations(id) on delete cascade,
  delivery_id uuid references public.confirmation_deliveries(id) on delete set null,
  channel text not null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_confirmation_delivery_events_confirmation_id
  on public.confirmation_delivery_events (confirmation_id);

create index if not exists idx_confirmation_delivery_events_delivery_id
  on public.confirmation_delivery_events (delivery_id);

create index if not exists idx_confirmation_delivery_events_channel
  on public.confirmation_delivery_events (channel);

create index if not exists idx_confirmation_delivery_events_created_at
  on public.confirmation_delivery_events (created_at desc);

create or replace function public.delivery_records_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists confirmation_deliveries_updated_at on public.confirmation_deliveries;
create trigger confirmation_deliveries_updated_at
before update on public.confirmation_deliveries
for each row execute function public.delivery_records_set_updated_at();

drop trigger if exists confirmation_qr_credentials_updated_at on public.confirmation_qr_credentials;
create trigger confirmation_qr_credentials_updated_at
before update on public.confirmation_qr_credentials
for each row execute function public.delivery_records_set_updated_at();

alter table public.confirmation_deliveries enable row level security;
alter table public.confirmation_qr_credentials enable row level security;
alter table public.confirmation_delivery_events enable row level security;

drop policy if exists "confirmation deliveries admin select" on public.confirmation_deliveries;
drop policy if exists "confirmation deliveries admin insert" on public.confirmation_deliveries;
drop policy if exists "confirmation deliveries admin update" on public.confirmation_deliveries;

create policy "confirmation deliveries admin select"
on public.confirmation_deliveries
for select
to authenticated
using (public.is_wtw_admin());

create policy "confirmation deliveries admin insert"
on public.confirmation_deliveries
for insert
to authenticated
with check (public.is_wtw_admin());

create policy "confirmation deliveries admin update"
on public.confirmation_deliveries
for update
to authenticated
using (public.is_wtw_admin())
with check (public.is_wtw_admin());

drop policy if exists "confirmation qr credentials admin select" on public.confirmation_qr_credentials;
drop policy if exists "confirmation qr credentials admin insert" on public.confirmation_qr_credentials;
drop policy if exists "confirmation qr credentials admin update" on public.confirmation_qr_credentials;

create policy "confirmation qr credentials admin select"
on public.confirmation_qr_credentials
for select
to authenticated
using (public.is_wtw_admin());

create policy "confirmation qr credentials admin insert"
on public.confirmation_qr_credentials
for insert
to authenticated
with check (public.is_wtw_admin());

create policy "confirmation qr credentials admin update"
on public.confirmation_qr_credentials
for update
to authenticated
using (public.is_wtw_admin())
with check (public.is_wtw_admin());

drop policy if exists "confirmation delivery events admin select" on public.confirmation_delivery_events;
drop policy if exists "confirmation delivery events admin insert" on public.confirmation_delivery_events;
drop policy if exists "confirmation delivery events admin update" on public.confirmation_delivery_events;

create policy "confirmation delivery events admin select"
on public.confirmation_delivery_events
for select
to authenticated
using (public.is_wtw_admin());

create policy "confirmation delivery events admin insert"
on public.confirmation_delivery_events
for insert
to authenticated
with check (public.is_wtw_admin());

create policy "confirmation delivery events admin update"
on public.confirmation_delivery_events
for update
to authenticated
using (public.is_wtw_admin())
with check (public.is_wtw_admin());

revoke all on public.confirmation_deliveries from public;
revoke all on public.confirmation_deliveries from anon;
revoke all on public.confirmation_qr_credentials from public;
revoke all on public.confirmation_qr_credentials from anon;
revoke all on public.confirmation_delivery_events from public;
revoke all on public.confirmation_delivery_events from anon;

grant select, insert, update on public.confirmation_deliveries to authenticated;
grant select, insert, update on public.confirmation_qr_credentials to authenticated;
grant select, insert, update on public.confirmation_delivery_events to authenticated;
