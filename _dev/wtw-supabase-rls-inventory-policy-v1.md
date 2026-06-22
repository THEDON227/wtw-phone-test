# WTW Supabase RLS Inventory Policy v1

## Purpose
This document records the safe read model for WTW inventory data.

## Current policy
- `public.events` is public inventory and anon select is allowed.
- `public.venues` is public inventory and anon select is allowed.
- The Telegram bot reads public inventory using the anon key.
- The public website may read the same inventory with a static fallback.
- Admin and private request visibility must remain controlled.
- Do not use `service_role` in the frontend.
- Do not paste tokens or keys into docs.

## Private request tables that must stay protected
- `reservation_requests`
- `ticket_requests`
- `guest_list_requests`
- `wave_pass_requests`
- `partner_applications`

## Safe SQL used for public inventory reads
The public inventory read policies were applied only to `public.events` and `public.venues`.

```sql
alter table public.events enable row level security;
alter table public.venues enable row level security;

drop policy if exists "public read events" on public.events;
create policy "public read events"
on public.events
for select
to anon
using (true);

drop policy if exists "public read venues" on public.venues;
create policy "public read venues"
on public.venues
for select
to anon
using (true);
```

## Safety notes
- Keep customer request tables private.
- Keep public inventory separate from customer records.
- Do not add frontend writes.
- Do not add secret-bearing env values to docs.
