# WTW Mobile App Supabase Sync Roadmap v1

## Direction
- Website first.
- Telegram bot first.
- Supabase inventory first.
- Mobile app later.

## Principle
The mobile app should read the same public events and venues inventory from Supabase.
It should not become the source of truth for that inventory.

## Future app sections
- Radar
- Events
- Indulge
- Wave Pass
- Partners

## Sync model
- Public inventory: read from Supabase.
- Private requests: remain protected.
- Admin flows: stay controlled.

## Safety
- No secrets committed.
- No live writes from this roadmap.
- No public UI changes.
- No schema changes.
