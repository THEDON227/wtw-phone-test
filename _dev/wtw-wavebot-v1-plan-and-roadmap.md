# WTW WaveBot v1 Plan and Roadmap

## What WaveBot v1 does

WaveBot v1 is a public-facing "Plan My Night" concierge page for WTW.
It helps users build a safe, curated nightlife route from public inventory only.

WaveBot v1 is rules-based and data-driven:
- reads `public.events`
- reads `public.venues`
- uses static fallback inventory if live reads fail
- does not use OpenAI or any external AI API

## What WaveBot v1 does not do

- no Supabase writes
- no request submission
- no service_role key
- no private table reads
- no customer data collection beyond the browser session used for planning
- no guaranteed entry or guaranteed table language

## Public inventory only

WaveBot v1 reads the same public inventory already used by the site:
- `events`
- `venues`

Private request/customer tables remain protected:
- `reservation_requests`
- `ticket_requests`
- `guest_list_requests`
- `wave_pass_requests`
- `partner_applications`

## Safety language

Use:
- curated
- request
- priority review
- subject to confirmation
- high interest

Avoid:
- guaranteed
- verified partner
- confirmed entry
- guaranteed table
- instant approval

## Future WaveBot requests table

WaveBot does not write this table yet. This is a future-only draft.

```sql
-- DRAFT ONLY - DO NOT RUN WITHOUT REVIEW
create table if not exists public.wavebot_requests (
  id uuid primary key default gen_random_uuid(),
  user_name text,
  user_email text,
  phone text,
  market text,
  timing text,
  desired_date date,
  occasion text,
  group_size integer,
  budget text,
  vibe text,
  desired_flow text,
  access_need text,
  generated_plan_summary text,
  selected_event_id uuid,
  selected_venue_id uuid,
  selected_option text,
  status text default 'new',
  created_at timestamptz not null default now()
);
```

## Future admin view

When WaveBot requests are ready to activate, the admin dashboard can add a read-only
WaveBot request view for:
- generated plan summary
- selected event / venue
- market
- timing
- occasion
- group size
- access need
- status

## Future Telegram operator commands

Possible future commands only:
- `/wavebot_requests`
- `/wavebot_brief`

These should stay read-only until a safe server-side flow exists.

## Wave Pass routing idea

WaveBot can eventually route members into Wave Pass when the night needs:
- priority review
- recurring planning
- birthday support
- group support
- dinner-to-night routing

Wave Pass should still not promise guaranteed access.

## Recommended next implementation step

When WaveBot v1 is stable, add a server-side request flow for:
- saving a selected WaveBot plan
- showing the plan in admin
- routing a request into existing request tables only after approval

If a server-side AI layer is added later, it should be backend-only and never expose API keys in the browser.
