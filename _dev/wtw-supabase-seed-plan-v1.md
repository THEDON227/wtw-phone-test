# WTW Supabase Seed Plan v1

## 1. Current state

- The public site still has hardcoded/static event and venue data in `events.html`, `all-events.html`, `event-detail.html`, `indulge.html`, and `indulge-detail.html`.
- The Telegram Operator Bot can already read Supabase safely in read-only mode.
- No Supabase writes are being done yet.
- No public UI changes are included in this plan.
- The Telegram bot reads Supabase for data commands, but the public site still uses static site data for display.

## 2. Where the current data lives

### Public event data

Static event objects live in the public event pages. The common shape includes:

- `id`
- `title`
- `venue`
- `city`
- `neighborhood`
- `date` as a human-readable string
- `time`
- `endTime`
- `price`
- `glPrice`
- `vipMin`
- `cats`
- `tags`
- `desc`
- `dresscode`
- `age`
- `status`
- `featured`
- `img`
- `promoter`

### Public venue data

Static venue objects live in the Indulge pages. The common shape includes:

- `name`
- `area`
- `vibe`
- `category`
- `bestFor`
- `priceTier`
- `turnsIntoNightlife`
- `image`
- `description`

## 3. Supabase schema targets

### `public.events`

Required fields:

- `title`
- `venue_name`
- `market`

Existing schema fields that can be populated from the site:

- `event_date`
- `start_time`
- `end_time`
- `address`
- `image_url`
- `description`
- `music`
- `dress_code`
- `age_requirement`
- `ticket_price`
- `guest_list_available`
- `vip_table_available`
- `status`

### `public.venues`

Required fields:

- `name`
- `market`

Existing schema fields that can be populated from the site:

- `type`
- `neighborhood`
- `address`
- `image_url`
- `price_tier`
- `atmosphere`
- `best_for`
- `dress_code`
- `reservation_available`
- `table_available`
- `guest_list_available`
- `description`
- `status`

## 4. Recommended field mapping

### Events mapping

- `title` -> `title`
- `venue` -> `venue_name`
- `city` -> `market`
- `date` -> `event_date` after parsing to ISO date
- `time` -> `start_time`
- `endTime` -> `end_time`
- `price` -> `ticket_price`
- `desc` -> `description`
- `dresscode` -> `dress_code`
- `age` -> `age_requirement`
- `img` -> `image_url`
- `status` -> `status`

Optional or derived fields:

- `cats` / `tags` can inform `category`, `music`, `guest_list_available`, and `vip_table_available`
- `glPrice` and `vipMin` do not have a direct schema field in `events`; keep them in notes or derive a future intake policy
- `featured` can stay as a UI-only concept unless a future schema field is added

### Venues mapping

- `name` -> `name`
- `city` -> `market`
- `category` -> `type`
- `area` -> `neighborhood`
- `image` -> `image_url`
- `priceTier` -> `price_tier`
- `vibe` -> `atmosphere`
- `bestFor` -> `best_for`
- `description` -> `description`

Optional or derived fields:

- `turnsIntoNightlife` can inform `reservation_available`, `table_available`, and `guest_list_available`, but should be reviewed before writing any rows
- `address` is not present in the public static venue arrays and should be filled only if verified later

## 5. Safest way to load later

Recommended sequence:

1. Export the current static event and venue records into a reviewable JSON or CSV file.
2. Normalize city names to the WTW markets used in Supabase.
3. Parse `date` strings into `event_date` before any load.
4. Review a small sample by hand before any full import.
5. Load through a controlled admin workflow only after approval.
6. Keep the Telegram bot read-only while the seed is being prepared.

Preferred load paths later:

- reviewed CSV/JSON import through a protected admin workflow
- or a one-off migration script run by an approved operator

Avoid:

- writing from the Telegram bot
- public-page writes
- ad hoc direct browser writes

### Manual Supabase SQL Editor steps

1. Open the Supabase SQL Editor for the target project.
2. Review the seed SQL file locally first.
3. Paste the SQL from `_dev/sql/wtw-seed-current-site-data-v1.sql`.
4. Verify the counts and the city mapping before running.
5. Execute only after approval.
6. Re-run the Telegram read commands after the load to confirm the rows are visible.

## 6. Recommended next load order

1. `events`
2. `venues`
3. request tables already used by the operator bot:
   - `reservation_requests`
   - `ticket_requests`
   - `guest_list_requests`
   - `wave_pass_requests`
   - `partner_applications`

## 7. Safety notes

- No Supabase writes are being made by this plan.
- No secrets are included.
- No service role key is needed for the plan itself.
- No public UI change is required.
- Keep event date parsing explicit so the bot can read `event_date` reliably.
- Keep empty-table messaging honest: if `events` is empty, the site may still be using static event data.

## 8. Exact reviewed seed package

Files created:

- `_dev/sql/wtw-seed-current-site-data-v1.sql`
- `_dev/wtw-current-site-data-export-v1.json`

Prepared row counts:

- Events: 121
- Venues: 41

Event date field used:

- `event_date`

Duplicate protection method:

- `INSERT ... SELECT ... WHERE NOT EXISTS`
- Events match on `title + market + event_date + venue_name`
- Venues match on `name + market`

Public site warning:

- The public site still uses static data today; this seed is the bridge to move the same content into Supabase later.

Telegram note:

- The Telegram bot now reads Supabase for read-only data commands, so once the seed is loaded the bot can return real event and venue data instead of empty-state responses.
