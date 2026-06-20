# WTW Manual Feedback Email Flow v1

## 1. Purpose
This flow lets WTW collect private post-night feedback before automation exists.

The goal is to learn what actually happened after a ticket, reservation, table, Wave Pass, or VIP/group experience, then use that signal internally to improve routing, partner review, and member recommendations.

This is not a public review flow. Feedback stays private to WTW.

## 2. When To Send
Send the feedback link only after the guest experience has happened:

- After an event ends
- After a reservation time passes
- After a table or nightlife request is completed
- After a Wave Pass member uses a routed experience
- After a manually handled VIP or group night is complete

Do not send the feedback request before the guest has experienced the room, door, table, crowd, or service.

## 3. Who Receives It
Manual feedback links can be sent to:

- Ticket buyers
- Reservation guests
- Table request guests
- Wave Pass members
- Manually routed VIP/group requests

Prioritize guests whose feedback can improve future routing decisions: confirmed guests, high-value members, group organizers, VIP requests, and any experience where WTW needs to verify partner quality.

## 4. Email Template
Subject: How was the night?

Hi {{first_name}},

Quick check-in from WTW. How was the night at {{venue_or_event}}?

Your feedback stays private to WTW and helps us route better rooms, protect the member experience, and review partner quality.

It takes under 30 seconds:

{{feedback_link}}

Thank you,  
WTW

## 5. SMS Template Later
WTW: How was the night? Private feedback helps us route better rooms. Takes under 30 seconds: {{feedback_link}}

## 6. Feedback Link Format
Current manual links can prefill context with query parameters:

```text
feedback.html?source=reservation&request=REQ123&city=nyc&venue=The%20Nines
```

```text
feedback.html?source=ticket&order=ORD123&city=nyc&event=Friday%20Night
```

Useful parameters:

- `source`: reservation, ticket, table, wave_pass, guest_list, manual
- `request`: internal request reference
- `order`: order reference when a ticket/payment/order reference exists
- `city`: market or city, such as nyc
- `venue`: venue name
- `event`: event name
- `date`: experience date

These links are convenience links only. They are not secure identity proof.

## 7. Future Token Format
Future secure links should use a token:

```text
feedback.html?token=SECURE_TOKEN
```

The token should map to request/order context in Supabase later. That lets WTW prefill source, request, order, city, venue, event, and date without exposing raw identifiers in the URL.

The token should also support one-use or limited-use validation so feedback cannot be easily spammed or submitted for the wrong experience.

## 8. Manual Workflow For Kwame/Admin
1. Check completed confirmations, completed requests, or event/ticket activity.
2. Confirm the experience has already happened.
3. Build the correct feedback link with the available context.
4. Send the email manually using the WTW tone and template.
5. Log who was sent the feedback link and when.
6. Avoid sending repeated reminders unless the experience is high priority.
7. Review submitted feedback later for venue quality, routing quality, and partner follow-up.

## 9. Rules
- Do not send before the experience happens.
- Do not over-message guests.
- Do not promise public reviews or public placement.
- Feedback stays private to WTW.
- Bad feedback is internal intelligence, not public content.
- Do not share private notes or contact details with partners.
- Partners should not directly edit ratings.
- Any public signal later must be curated and approved by WTW.

## 10. Future Automation
Later phases can add:

- Scheduled post-event email follow-up
- SMS follow-up for high-value or time-sensitive experiences
- Supabase token validation
- Feedback save flow into `experience_feedback`
- Admin feedback dashboard
- WTW Bot reports for review count, bad feedback, venue trends, city trends, and weekly summaries

Automation should stay tasteful: one short follow-up after the experience, limited reminders, and no spammy language.

## 11. Recommended Next Loop
The smallest safe next step is a read-only implementation plan for tokenized feedback links:

- Define token fields and lifecycle
- Decide whether validation belongs in an RPC or Edge Function
- Map token context to `feedback.html`
- Keep public insert deferred until token validation exists
- Preserve private feedback rules before adding automation
