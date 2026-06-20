# WTW Tokenized Feedback Link Flow v1

## 1. Purpose
Tokenized feedback links give WTW a safer way to collect private post-experience feedback.

WTW needs tokens because plain query-string links can expose request/order details and can be copied, guessed, or reused without enough context. Token links should:

- Prevent fake or spam feedback
- Hide request and order details from the URL
- Tie feedback to real completed experiences
- Support one-time feedback submission
- Give WTW cleaner data for routing, partner review, and future bot summaries

This is still a private operating flow. It is not a public review system.

## 2. Token Link Format
Current temporary format:

```text
feedback.html?source=reservation&request=REQ123&city=nyc&venue=The%20Nines
```

Future secure format:

```text
feedback.html?token=SECURE_TOKEN
```

The secure token should load the experience context later without showing raw request IDs, order IDs, user contact details, or internal routing context in the URL.

## 3. Token Lifecycle
1. A request, ticket, table, Wave Pass, or manual VIP/group experience is confirmed or completed.
2. WTW generates a feedback token for that specific experience.
3. WTW includes the token link in a feedback email or SMS after the experience happens.
4. The user opens `feedback.html?token=SECURE_TOKEN`.
5. The feedback page validates the token and loads safe display context, such as city, venue, event, and date.
6. The user submits feedback.
7. The token becomes used/locked so it cannot submit duplicate feedback.
8. Admin can review the feedback and token status later.

Tokens should not be generated or sent before the experience has happened.

## 4. Token Data Model Draft
A future token table or token fields should track enough context to validate and prefill feedback safely:

- `feedback_token`
- `source_type`
- `request_id`
- `order_id`
- `user_contact`
- `city`
- `venue_name`
- `event_name`
- `experience_date`
- `token_status`: active, used, expired, revoked
- `expires_at`
- `created_at`
- `used_at`

Recommended behavior:

- `feedback_token` should be unique.
- `token_status` should start as `active`.
- `expires_at` should limit old links.
- `used_at` should be set when feedback is accepted.
- User contact should stay private and should not be returned to public page code.

## 5. Security Rules
- Allow one accepted feedback submission per token.
- Tokens should be random, high-entropy, and hard to guess.
- Tokens should expire after a defined window.
- Expired, used, or revoked tokens should not accept new submissions.
- Public users cannot list feedback rows.
- Public users cannot list token rows.
- Private notes stay WTW-only.
- User contact stays WTW-only.
- Partners cannot directly edit ratings.
- Partners should not see raw private notes or contact details.
- The bot can summarize feedback only after admin-approved access rules exist.
- Bot summaries should not publish raw complaints or private notes without operator approval.

## 6. Feedback Page Behavior Later
Later, `feedback.html` should support token mode:

1. Read `token` from the URL.
2. Call a secure RPC or Edge Function to validate the token.
3. Receive only safe display context: source type, city, venue, event, and experience date.
4. Never expose private user contact, internal notes, or partner routing details to page code.
5. Validate required selections before submit.
6. Submit feedback through a secure RPC or Edge Function.
7. Disable duplicate submit attempts while saving.
8. Show a success state when accepted.
9. Show a clear expired state if the token is expired.
10. Show an already-used state if the token has already submitted feedback.
11. Show a generic invalid-link state if the token is missing or not recognized.

The public page should not directly insert raw feedback with anonymous table access unless token validation is enforced server-side.

## 7. Admin/Kwame Workflow
Manual first:

1. Confirm the request, order, table, Wave Pass, or VIP/group experience has happened.
2. Create a token for the completed experience.
3. Send the token link manually by email first.
4. Log who received the link and when.
5. Check token status before resending.
6. Resend only if needed.
7. Avoid repeated reminders or spammy follow-ups.
8. Review submitted feedback in admin once the dashboard exists.

Later automation:

- Generate tokens automatically after confirmation or completed experience.
- Show token status in admin.
- Let Kwame/admin revoke or expire a token if needed.
- Keep manual override available for high-value guests and edge cases.

## 8. Future Automation
Future phases can add:

- Automatic token creation after completed confirmations
- Scheduled post-event email follow-up
- SMS follow-up for high-value or time-sensitive experiences
- Token validation through Supabase RPC or Edge Function
- Feedback save flow into `experience_feedback`
- Admin dashboard for feedback and token status
- WTW Bot reports for review count, bad feedback, venue trends, city trends, and weekly summaries

Automation should stay restrained. One useful follow-up is better than repeated messages that feel like marketing.

## 9. Recommended Next Loop
The smallest safe next step is a SQL-only token model draft for review.

Recommended allowed file:

- `_dev/sql/feedback-token-phase3.sql`

Recommended scope:

- Draft a `feedback_tokens` table or token columns
- Add status constraints for active, used, expired, revoked
- Add indexes for token lookup, source type, request/order, status, and expiration
- Add RLS draft that blocks public select/list access
- Leave actual RPC, Edge Function, `feedback.html`, and `supabase-client.js` changes for later
