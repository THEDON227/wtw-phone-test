-- WTW Phase 1 Supabase schema
-- Luxury nightlife operating system foundation.
-- No payments, no AI, no mobile app. Frontend intake only.

create extension if not exists "pgcrypto";

-- Optional helper trigger for updated_at fields if added later.

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  full_name text,
  phone text,
  auth_provider text default 'email',
  preferred_market text,
  role text default 'guest',
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  venue_name text not null,
  market text not null,
  category text,
  event_date date,
  start_time time,
  end_time time,
  address text,
  image_url text,
  description text,
  music text,
  dress_code text,
  age_requirement text,
  ticket_price numeric(10,2),
  guest_list_available boolean default false,
  vip_table_available boolean default false,
  status text default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  market text not null,
  type text,
  neighborhood text,
  address text,
  image_url text,
  price_tier text,
  atmosphere text,
  best_for text,
  dress_code text,
  reservation_available boolean default false,
  table_available boolean default false,
  guest_list_available boolean default false,
  description text,
  status text default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists public.reservation_requests (
  id uuid primary key default gen_random_uuid(),
  user_name text not null,
  user_email text not null,
  phone text,
  market text not null,
  venue_id uuid references public.venues (id) on delete set null,
  venue_name text,
  requested_date date,
  requested_time time,
  party_size integer,
  occasion text,
  notes text,
  status text default 'new',
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_requests (
  id uuid primary key default gen_random_uuid(),
  user_name text not null,
  user_email text not null,
  phone text,
  event_id uuid references public.events (id) on delete set null,
  event_title text,
  ticket_type text,
  quantity integer,
  total_amount numeric(10,2),
  status text default 'new',
  created_at timestamptz not null default now()
);

create table if not exists public.guest_list_requests (
  id uuid primary key default gen_random_uuid(),
  user_name text not null,
  user_email text not null,
  phone text,
  event_id uuid references public.events (id) on delete set null,
  event_title text,
  market text,
  party_size integer,
  arrival_time text,
  notes text,
  status text default 'new',
  created_at timestamptz not null default now()
);

create table if not exists public.partner_applications (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  business_type text not null,
  market text not null,
  website text,
  instagram text,
  contact_name text,
  contact_role text,
  email text,
  phone text,
  wave_member_offer text,
  notes text,
  status text default 'new',
  created_at timestamptz not null default now()
);

create table if not exists public.wave_pass_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  market text not null,
  nightlife_interest text,
  notes text,
  status text default 'new',
  created_at timestamptz not null default now()
);

create index if not exists idx_events_market_date on public.events (market, event_date);
create index if not exists idx_venues_market on public.venues (market);
create index if not exists idx_reservation_requests_market on public.reservation_requests (market, created_at desc);
create index if not exists idx_ticket_requests_event on public.ticket_requests (event_id, created_at desc);
create index if not exists idx_guest_list_requests_event on public.guest_list_requests (event_id, created_at desc);
create index if not exists idx_partner_applications_market on public.partner_applications (market, created_at desc);
create index if not exists idx_wave_pass_requests_market on public.wave_pass_requests (market, created_at desc);

