# WTW Supabase Integration Notes

## Phase 1 scope
- Keep the current HTML/CSS/JS frontend intact.
- Add Supabase only as a data layer for requests, intake, and admin reads.
- Do not add payments, AI bots, or a native app yet.

## Recommended environment variables
- `WTW_SUPABASE_URL`
- `WTW_SUPABASE_ANON_KEY`

## Frontend runtime plan
1. Load the Supabase JS runtime on pages that need data access.
2. Set `window.WTW_SUPABASE_CONFIG` from build-time or injected env values.
3. Call the helper functions from `supabase-client.js`.
4. Keep request forms usable even if Supabase is offline by falling back to a soft failure message.

## Recommended request flow
- Events page: ticket requests and guest list requests.
- Indulge pages: reservation requests.
- Partners page: partner applications.
- Wave Pass page: interest capture.
- Admin page: read queues and update status later.

## Data conventions
- Use `status` values like `new`, `reviewing`, `approved`, `rejected`, `archived`.
- Keep `market` values normalized: `New York`, `New Jersey`, `Florida`, `Georgia`, `California`, `Texas`.
- Use `created_at` ordering for queue views.

## Future account plan
- Google login and Apple login can be added later through Supabase Auth.
- Guest checkout can stay request-only until the product needs authenticated profiles.
- Wave Pass accounts can be layered on top of the `users` table once membership is real.
