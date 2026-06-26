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
- no elevated backend key
- no private table reads
- no customer data collection beyond the browser session used for planning
- no overpromising access language

## WaveBot v2 UX direction

WaveBot v2 should feel like a premium nightlife concierge instead of a long form.

Design goals:
- chat-first and mobile-first
- large hero prompt box up front
- quick chips instead of a heavy form
- hidden advanced details behind a collapsed section
- visible response panel near the top
- 2 to 3 obvious plan cards after submit
- dark, polished, nightlife-forward visual language
- Wave Pass stays the premium routing layer, not a replacement for WaveBot

Rules:
- no external AI yet
- no private table reads
- no public customer data exposure
- no overpromising access language
- no frontend API keys for future AI
- keep static fallback inventory available if Supabase fails

Future direction:
- keep planning rules-based for now
- keep public inventory read-only
- move any future AI to a server-side flow only
- keep Wave Pass as the priority review / upgrade layer

## WaveBot v2 professional polish pass

The polish pass should make WaveBot feel more like a premium nightlife concierge and less like a developer form.

Focus areas:
- chat-first UI with one clear prompt and quick chips
- less text-heavy result cards with a stronger recommended card
- a Best Match treatment for the first route
- tighter CTA hierarchy with clear primary and secondary actions
- Wave Pass positioned as an upgrade layer, not a replacement
- no external AI yet
- no private table reads
- no overpromising language

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
- overpromising access language

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
Wave Pass should still not promise access certainty.

## Recommended next implementation step

When WaveBot v1 is stable, add a server-side request flow for:
- saving a selected WaveBot plan
- showing the plan in admin
- routing a request into existing request tables only after approval

If a server-side AI layer is added later, it should be backend-only and never expose API keys in the browser.
