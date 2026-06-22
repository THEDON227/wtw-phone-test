-- WTW Invite System Draft v1
-- DRAFT ONLY - DO NOT RUN WITHOUT REVIEW

-- This file is documentation for a future invite system.
-- It is not connected to any live workflow yet.
-- No destructive operations are included here.

-- Suggested future table: invite_codes
-- Suggested future table: invite_redemptions

create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  invite_type text not null,
  market text,
  target_name text,
  target_email text,
  target_phone text,
  status text not null default 'draft',
  issued_at timestamptz,
  expires_at timestamptz,
  redeemed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  invite_code_id uuid references public.invite_codes(id),
  redeemed_by_name text,
  redeemed_by_email text,
  redeemed_by_phone text,
  status text not null default 'draft',
  redeemed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- Safe future indexes could be added later after review.
-- No DELETE, TRUNCATE, DROP, ALTER, UPDATE, or RPC is included.
