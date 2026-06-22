# WTW Telegram Operator Bot Commands v1

## Current working commands
- `/help`
- `/status`
- `/data_status`
- `/events_status`
- `/venues_status`
- `/cities_status`
- `/events_this_week`
- `/tonight [city]`
- `/weekend [city]`
- `/city_brief [city]`
- `/requests_today`
- `/reservations_today`
- `/guest_list_today`
- `/tickets_today`
- `/latest_requests`
- `/wave_pass_requests`
- `/partner_requests`
- `/operator_brief`
- `/ask [question]`

## Runtime notes
- Railway is paused / trial maxed right now.
- The local Mac bot can run with:
  - `caffeinate -dimsu node scripts/wtw-telegram-bot.mjs`
- Only one bot instance can run at a time or Telegram returns a `409 conflict`.

## Safety
- Read-only commands only.
- No Supabase writes.
- No public UI edits.
- No secrets in commands or docs.
