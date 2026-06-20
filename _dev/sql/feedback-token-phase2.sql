-- WTW Feedback Token Phase 2 SQL draft
-- Review-only draft. Do not run against Supabase until approved.
-- Tokens are private operational records for secure post-experience feedback.

create extension if not exists "pgcrypto";

create table if not exists public.feedback_tokens (
  id uuid primary key default gen_random_uuid(),
  feedback_token text unique not null,
  source_type text not null,
  request_id uuid null,
  order_id text null,
  user_contact text null,
  city text,
  venue_name text,
  event_name text,
  experience_date date,
  token_status text not null default 'active',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  used_at timestamptz null,
  revoked_at timestamptz null,
  metadata jsonb default '{}'::jsonb,

  constraint feedback_tokens_source_type_check
    check (source_type in ('ticket', 'reservation', 'guest_list', 'table', 'wave_pass', 'manual')),
  constraint feedback_tokens_token_status_check
    check (token_status in ('active', 'used', 'expired', 'revoked'))
);

comment on table public.feedback_tokens is
  'Private WTW token records for secure post-experience feedback links.';

comment on column public.feedback_tokens.feedback_token is
  'Random, hard-to-guess, one-use token for feedback.html?token=SECURE_TOKEN links.';

comment on column public.feedback_tokens.user_contact is
  'Private member/contact reference. Must not be exposed publicly or to partners.';

comment on column public.feedback_tokens.metadata is
  'Private operational metadata for token generation, sending, and follow-up context.';

comment on column public.feedback_tokens.token_status is
  'Token lifecycle state. Active tokens may be validated later; used, expired, and revoked tokens should not accept feedback.';

create index if not exists idx_feedback_tokens_feedback_token
  on public.feedback_tokens (feedback_token);

create index if not exists idx_feedback_tokens_token_status
  on public.feedback_tokens (token_status);

create index if not exists idx_feedback_tokens_source_type
  on public.feedback_tokens (source_type);

create index if not exists idx_feedback_tokens_city
  on public.feedback_tokens (city);

create index if not exists idx_feedback_tokens_venue_name
  on public.feedback_tokens (venue_name);

create index if not exists idx_feedback_tokens_expires_at
  on public.feedback_tokens (expires_at);

create index if not exists idx_feedback_tokens_created_at
  on public.feedback_tokens (created_at desc);

alter table public.feedback_tokens enable row level security;

-- RLS draft:
-- - No anon SELECT policy is defined. Public users cannot list or inspect tokens.
-- - No anon INSERT, UPDATE, or DELETE policy is defined. Public direct writes are blocked.
-- - WTW admins/operators can select, create, and update token records later.
-- - Token validation should happen through a secure RPC or Edge Function, not raw
--   public table access.
-- - feedback.html should only receive safe display context later, such as city,
--   venue, event, source type, and experience date.
-- - user_contact must never be exposed publicly.
-- - Partners cannot create, edit, or view raw token records.
-- - The WTW Bot may summarize token status later, but cannot expose private
--   user/contact details.

drop policy if exists "feedback tokens admin select" on public.feedback_tokens;
create policy "feedback tokens admin select"
on public.feedback_tokens
for select
to authenticated
using (public.is_wtw_admin());

drop policy if exists "feedback tokens admin insert" on public.feedback_tokens;
create policy "feedback tokens admin insert"
on public.feedback_tokens
for insert
to authenticated
with check (public.is_wtw_admin());

drop policy if exists "feedback tokens admin update" on public.feedback_tokens;
create policy "feedback tokens admin update"
on public.feedback_tokens
for update
to authenticated
using (public.is_wtw_admin())
with check (public.is_wtw_admin());

-- Optional future grant draft. Keep aligned with RLS and admin auth.
-- revoke all on public.feedback_tokens from public;
-- revoke all on public.feedback_tokens from anon;
-- grant select, insert, update on public.feedback_tokens to authenticated;

-- Optional future RPC notes:
--
-- validate_feedback_token(token text)
-- - Accepts a token string.
-- - Returns only safe display context if active and not expired.
-- - Does not return user_contact, metadata, internal notes, or raw token records.
-- - Returns expired, used, revoked, or invalid states without leaking private data.
--
-- mark_feedback_token_used(token text)
-- - Runs inside the final feedback submission transaction.
-- - Sets token_status = 'used' and used_at = now().
-- - Prevents duplicate accepted submissions for the same token.
--
-- generate_feedback_token_for_request(request_id uuid)
-- - Admin/server-side helper for creating random feedback tokens.
-- - Copies safe request/order context into public.feedback_tokens.
-- - Sets expires_at based on WTW's approved feedback window.
