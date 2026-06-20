-- WTW Feedback Engine Phase 2 SQL draft
-- Review-only draft. Do not run against Supabase until approved.
-- Raw feedback is private WTW operating data, not public review content.

create extension if not exists "pgcrypto";

create table if not exists public.experience_feedback (
  id uuid primary key default gen_random_uuid(),
  source_type text,
  request_id uuid null,
  order_id text null,
  user_contact text null,
  city text,
  venue_name text,
  event_name text,
  experience_date date,
  overall_rating integer,
  door_flow_rating integer,
  vibe_rating integer,
  service_rating integer,
  would_return text,
  best_for_tags text[],
  private_note text,
  submitted_at timestamptz default now(),
  feedback_token text unique,
  status text default 'new',

  constraint experience_feedback_source_type_check
    check (
      source_type is null
      or source_type in ('ticket', 'reservation', 'guest_list', 'table', 'wave_pass', 'manual')
    ),
  constraint experience_feedback_overall_rating_check
    check (overall_rating is null or overall_rating between 1 and 5),
  constraint experience_feedback_door_flow_rating_check
    check (door_flow_rating is null or door_flow_rating between 1 and 5),
  constraint experience_feedback_vibe_rating_check
    check (vibe_rating is null or vibe_rating between 1 and 5),
  constraint experience_feedback_service_rating_check
    check (service_rating is null or service_rating between 1 and 5),
  constraint experience_feedback_would_return_check
    check (
      would_return is null
      or would_return in ('yes', 'maybe', 'no')
    ),
  constraint experience_feedback_status_check
    check (status in ('new', 'reviewed', 'flagged', 'archived'))
);

comment on table public.experience_feedback is
  'Private WTW post-experience feedback for internal routing quality, partner review, and future signal reporting.';

comment on column public.experience_feedback.user_contact is
  'Private member/contact reference. Must not be exposed publicly or to partners.';

comment on column public.experience_feedback.private_note is
  'Private free-text note for WTW operators only. Must not be exposed publicly or to partners.';

comment on column public.experience_feedback.feedback_token is
  'Future token for validated feedback links. Public insert should remain deferred until token-gated RPC or Edge Function exists.';

comment on column public.experience_feedback.best_for_tags is
  'Internal venue/event fit tags used for WTW routing and future curated signals.';

create index if not exists idx_experience_feedback_city
  on public.experience_feedback (city);

create index if not exists idx_experience_feedback_venue_name
  on public.experience_feedback (venue_name);

create index if not exists idx_experience_feedback_source_type
  on public.experience_feedback (source_type);

create index if not exists idx_experience_feedback_submitted_at
  on public.experience_feedback (submitted_at desc);

create index if not exists idx_experience_feedback_status
  on public.experience_feedback (status);

create index if not exists idx_experience_feedback_feedback_token
  on public.experience_feedback (feedback_token);

alter table public.experience_feedback enable row level security;

-- RLS draft:
-- - No anon SELECT policy is defined. Anonymous users cannot read raw feedback.
-- - No anon INSERT policy is defined yet. Public submission should be added only
--   through a token-gated RPC or Edge Function that validates feedback_token.
-- - WTW admins/operators can review and update raw feedback.
-- - Partners should not directly edit ratings or private notes.
-- - The WTW bot may summarize feedback later, but cannot publish raw notes,
--   contact details, or public-facing claims without operator approval.

drop policy if exists "experience feedback admin select" on public.experience_feedback;
create policy "experience feedback admin select"
on public.experience_feedback
for select
to authenticated
using (public.is_wtw_admin());

drop policy if exists "experience feedback admin update" on public.experience_feedback;
create policy "experience feedback admin update"
on public.experience_feedback
for update
to authenticated
using (public.is_wtw_admin())
with check (public.is_wtw_admin());

-- Optional future grant draft. Keep aligned with RLS and admin auth.
-- revoke all on public.experience_feedback from public;
-- revoke all on public.experience_feedback from anon;
-- grant select, update on public.experience_feedback to authenticated;

-- Optional future insert path draft:
-- Public insert should not be a plain anon table insert. Prefer either:
-- 1. A security-definer RPC that validates feedback_token, enforces one use,
--    inserts sanitized feedback, and never returns raw private data.
-- 2. A Supabase Edge Function that validates feedback_token server-side,
--    rate-limits submissions, and writes with service role.

-- Optional future view drafts for admin/bot summaries only.
-- Do not expose these publicly without a separate approval and curation layer.

-- create or replace view public.feedback_summary_by_venue as
-- select
--   venue_name,
--   city,
--   count(*) as feedback_count,
--   round(avg(overall_rating)::numeric, 2) as avg_overall_rating,
--   round(avg(door_flow_rating)::numeric, 2) as avg_door_flow_rating,
--   round(avg(vibe_rating)::numeric, 2) as avg_vibe_rating,
--   round(avg(service_rating)::numeric, 2) as avg_service_rating,
--   count(*) filter (where would_return = 'yes') as would_return_yes_count,
--   max(submitted_at) as latest_feedback_at
-- from public.experience_feedback
-- where venue_name is not null
-- group by venue_name, city;

-- create or replace view public.feedback_summary_by_city as
-- select
--   city,
--   count(*) as feedback_count,
--   round(avg(overall_rating)::numeric, 2) as avg_overall_rating,
--   round(avg(door_flow_rating)::numeric, 2) as avg_door_flow_rating,
--   round(avg(vibe_rating)::numeric, 2) as avg_vibe_rating,
--   round(avg(service_rating)::numeric, 2) as avg_service_rating,
--   max(submitted_at) as latest_feedback_at
-- from public.experience_feedback
-- where city is not null
-- group by city;

-- create or replace view public.recent_bad_feedback as
-- select
--   id,
--   source_type,
--   request_id,
--   order_id,
--   city,
--   venue_name,
--   event_name,
--   experience_date,
--   overall_rating,
--   door_flow_rating,
--   vibe_rating,
--   service_rating,
--   would_return,
--   best_for_tags,
--   private_note,
--   submitted_at,
--   status
-- from public.experience_feedback
-- where
--   submitted_at >= now() - interval '30 days'
--   and (
--     overall_rating <= 2
--     or door_flow_rating <= 2
--     or vibe_rating <= 2
--     or service_rating <= 2
--     or status = 'flagged'
--   )
-- order by submitted_at desc;
