# WTW Supabase + Telegram Bot Data Intelligence Plan v1

## 1. Current Supabase / data state
WTW already has a usable split between public discovery content, private request intake, and operator tooling.

Current state:
- Public site pages still carry most event and venue discovery data in hardcoded page arrays.
- Request forms already route into Supabase-backed helpers when the runtime is configured.
- The admin dashboard already expects Supabase reads for requests, partner management, confirmations, notes, and activity logging.
- The operator simulator is local-only and uses mock data plus local draft logging.
- The Telegram wrapper is a private bridge to the local simulator today; it does not read Supabase yet.

Important repository note:
- The root `schema.sql` file is not present.
- The current schema draft lives at `_dev/sql/schema.sql`.

## 2. Where events and venue data currently live
Public discovery content is still split across page files and browser state:

- `events.html` contains the main event inventory in a hardcoded `ALL_EVENTS` structure.
- `all-events.html` contains a broader discovery inventory in its own hardcoded event data.
- `event-detail.html` reads from `ALL_EVENTS` and localStorage/sessionStorage to render the selected event.
- `indulge.html` contains the restaurant / venue inventory in a hardcoded `VENUES` structure.
- `indulge-detail.html` reads from `VENUES` and sessionStorage/localStorage to render the selected venue.
- `pass.html` and `partners.html` are mostly presentation surfaces with form submission helpers.
- `localStorage` and `sessionStorage` are used as a browser handoff layer for selected city / selected venue context.

So for now, event and venue discovery is still a page-level source of truth, not a Supabase source of truth.

## 3. Existing tables the bot can read
The current schema draft and client wiring already define or reference these table families:

- `users`
- `events`
- `venues`
- `reservation_requests`
- `ticket_requests`
- `guest_list_requests`
- `partner_applications`
- `wave_pass_requests`
- `partners`
- `partner_users`
- `request_assignments`
- `customer_confirmations`
- `confirmation_deliveries`
- `confirmation_qr_credentials`
- `internal_notes`
- `activity_log`

The admin surface already assumes these kinds of read paths exist or will exist.

## 4. Data questions the bot should answer
The Telegram Operator Bot should eventually answer questions like:

- What are this week’s events?
- What reservations do we have today?
- What Wave Pass requests came in?
- What guest list requests came in?
- What ticket requests came in?
- What partner applications came in?
- What Miami partner invites are pending?
- Who needs follow-up?

The safe pattern is to return a short operational summary, not raw secrets or unrestricted table dumps.

## 5. Read-only first implementation plan
Start with read-only query commands only.

Recommended first Telegram data commands:
- `/data_status`
- `/requests_today`
- `/wave_pass_requests`
- `/partner_requests`

Behavior:
- Read from Supabase only if the runtime env vars are present and valid.
- Fail safely with a clear message if Supabase is not configured.
- Never attempt a write, update, confirm, or send action in these commands.
- Never expose secret values, raw tokens, or internal credentials.
- Keep response summaries compact enough for Telegram.

Recommended read model for the first phase:
- Use admin-approved read-only queries.
- Prefer time-bounded summaries over full raw lists.
- Return counts, top items, pending items, and follow-up queues.

## 6. Future write / update plan with approval
Later, after the read-only path is stable, add approval-gated write helpers for admin-only use.

Possible future write actions:
- Mark request reviewed
- Update request status
- Create partner notes
- Create activity logs
- Route a request to a partner
- Record follow-up status

Rules for the future write phase:
- Require explicit approval before any write.
- Require clear approval phrases, not vague replies.
- Keep writes limited to admin-approved workflows.
- Do not let the Telegram bot auto-confirm guests, tables, or partner placements.
- Do not let the bot send outbound customer or partner messages without approval.

## 7. New tables recommended if needed
If the current schema does not cover the reporting workflow cleanly, add new tables only when they solve a real operator problem.

Recommended future tables:
- `outreach_targets`
- `outreach_interactions`
- `invite_codes`
- `telegram_bot_query_logs`

Optional future additions only if needed:
- `bot_query_snapshots`
- `operator_followups`

Use cases:
- Track who Kwame wants to contact
- Track outreach history and follow-up state
- Track invite code usage if Wave Pass or partner invites need it
- Track Telegram bot queries for auditability

## 8. What the Telegram bot should eventually read
When Supabase is connected in read-only mode, the Telegram bot should eventually read:

- Today’s / this week’s events
- Reservation request queues
- Ticket request queues
- Guest list request queues
- Wave Pass requests
- Partner applications
- Partner routing status
- Follow-up queues
- Internal operator summaries

It should also be able to read safe rollups such as:
- counts by status
- counts by city
- counts by market
- pending vs confirmed
- aged items needing follow-up

## 9. What the Telegram bot may eventually write only after approval
Only after explicit approval and only in admin-controlled flows, the bot may eventually write:

- request status updates
- internal notes
- activity logs
- routing records
- invite status updates
- follow-up flags

Those writes should be limited to operator actions, not public-user content.

## 10. What the Telegram bot must never do
- Never create automated partner confirmations
- Never create automated customer messages
- Never imply guaranteed entry or guaranteed tables
- Never write to Supabase without approval
- Never commit secrets
- Never expose Supabase credentials
- Never send emails or SMS directly to customers without approval
- Never change public-site discovery content on its own
- Never bypass RLS or admin approval boundaries

## 11. Invite workflow
Recommended invite workflow for outreach and partner growth:

1. Create a target in the outreach list.
2. Send the invite manually.
3. Record the invite status.
4. Track the reply.
5. Convert the target into a partner application, partner record, or Wave Pass request when appropriate.

This keeps the workflow honest and reviewable.

Suggested statuses:
- target created
- invited
- replied
- interested
- meeting booked
- applied
- confirmed
- not a fit
- follow-up needed

## 12. Safety rules
- No automated partner confirmations.
- No automated customer messages.
- No guaranteed entry / guaranteed table language.
- No Supabase writes without approval.
- No secrets committed.
- No service role key in Telegram or browser code.
- No public-site edits from bot commands.
- No broad list access without scoped admin handling.
- No silent writes from the bot layer.

## 13. Recommended architecture choice
For the current stage, choose:

- A. Keep the public site frozen and let the bot read existing Supabase request tables only for now.

Why:
- The public discovery pages are already functioning and presentation-ready.
- The request tables are the safest high-value source to read first.
- The operator bot gets useful immediately without restructuring page content.
- Supabase reads can be gated and audited before any write path exists.

Later:
- B. Migrate event and venue data into Supabase as the single source of truth.

Optional stopgap:
- C. Keep a temporary read-only local adapter for hardcoded site data if the team wants the bot to summarize discovery content before the migration.

Recommended order:
1. Read-only request intelligence from Supabase.
2. Read-only summary of public discovery content via a local adapter if needed.
3. Migrate event / venue data into Supabase later when the schema is ready.

## 14. Recommended first implementation step
Add read-only Telegram bot data commands first:

- `/data_status`
- `/requests_today`
- `/wave_pass_requests`
- `/partner_requests`

These should:
- Read from Supabase only after environment variables are set.
- Fail safely if Supabase is not configured.
- Never write data.
- Never send messages beyond the Telegram reply itself.
- Never leak secrets.

## 15. WTW execution note
This plan is intentionally read-first.

The safe sequence is:
1. Stabilize the read-only Telegram data commands.
2. Use the bot for operator visibility.
3. Add approval-gated write actions only if the operator workflow actually needs them.
4. Keep the public site frozen unless fixing a real bug.
