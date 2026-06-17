# WTW Operating Brain v1

## 1. WTW Product Positioning

WTW is a luxury nightlife operating system.

WTW sells confidence, not guaranteed access.

Core pillars:
- `EVENTS` = what is happening
- `INDULGE` = where the night starts
- `WAVE PASS` = priority/access layer
- `PARTNERS` = the network powering it

Product principles:
- Route the request instead of forcing the user to hunt for answers.
- Keep the tone premium, concise, concierge-style, and honest.
- Never imply guaranteed entry or instant approval.
- Never describe review-based access as completed access.

## 2. Wave Pass Promise Map

What Wave Pass sells now:
- Priority review for the night ahead
- Weekly city drops
- Curated dinner-to-night routing
- Birthday and group planning support
- Request visibility across guest lists, tables, and reservations
- A digital member identity/card
- Concierge-style triage before partner confirmation

What remains manual:
- Final venue confirmation
- Minimums and final spend confirmation
- Door rules and timing exceptions
- Partner follow-up when a room is tight
- Any one-off comp, hold, or exception handling

What can be automated later:
- Preference capture and member profiling
- Draft itineraries by city, vibe, time, and group size
- Weekly city-drop generation
- Status summaries and reminders
- Request routing and queue triage
- Partner brief generation

What must not be promised yet:
- Guaranteed entry
- Guaranteed tables
- Instant approval
- Fully autonomous booking
- Universal QR/member access as a live feature
- Final pricing as if it is fixed before partner review

## 3. WTW Bot Roles

Member assistant
- Answers "where should we go" style questions
- Collects city, vibe, time, group size, and occasion
- Suggests a small set of options
- Routes the request for review

City drop assistant
- Produces the weekly city drop
- Surfaces new rooms, rooftop nights, dinner starts, and late options
- Filters by city, vibe, and timing

Admin/Kwame operator bot
- Turns inbound requests into clean drafts
- Produces partner notes and member replies
- Summarizes queue status
- Flags missing details or risky copy

Partner routing assistant
- Converts a member request into a partner-ready brief
- Suggests venue fit, timing, and likely friction points
- Tracks pending, reviewed, confirmed, and declined states

QA/Codex loop assistant
- Scans public pages for trust-language regressions
- Flags risky copy, fake guarantees, and pricing drift
- Checks that visible copy matches the product model

## 4. Command Examples

Kwame commands
- `/drop nyc friday rooftops 8pm premium`
- `/brief miami birthday 6 dinner-to-night`
- `/route member 0347 to la lounges`
- `/status request 12084`
- `/scan public-copy`
- `/draft partner note for Komodo Dallas`
- `/summarize wavepass queue`

Future member commands
- `Birthday dinner for 8 in Miami Saturday`
- `Best rooftop before nightlife tonight`
- `Need a dinner start that can move into a late room`
- `Show me request status`
- `What should I book for a group of 6 in New York?`

Future partner commands
- `Update minimum spend for tonight`
- `Mark request confirmed`
- `Mark request declined`
- `Add late seating availability`
- `Send WTW a note on timing or dress code`
- `Flag private room availability`

## 5. Safety + Approval Rules

Bot can draft:
- Member replies
- Partner outreach notes
- City drop summaries
- Venue-fit explanations
- Copy variations for review

Bot can check:
- Copy for guarantee language
- Pricing language for false certainty
- Availability wording
- Request completeness
- Event/venue fit against city and timing

Bot can recommend:
- Best venue matches
- Whether a request should be routed
- Whether pricing should be shown as typical or partner-confirmed
- Whether wording is too strong for public use

Requires Kwame approval:
- Any outbound partner message
- Any member-facing confirmation
- Any public copy change
- Any data write that changes status, pricing, or availability
- Any automation that sends without review

Should never auto-send or auto-push:
- Public website edits
- Confirmation messages
- Partner confirmations
- Pricing updates
- Marketing sends
- Any status transition that affects the user's belief about access

## 6. Status Model

Use a simple human-readable state model:
- `new request`
- `under WTW review`
- `sent to partner`
- `pending venue confirmation`
- `confirmed`
- `declined`
- `needs more info`

State guidance:
- `new request` means the request has arrived but no routing has happened yet.
- `under WTW review` means the request is being checked for fit, timing, and completeness.
- `sent to partner` means WTW has routed the request outward.
- `pending venue confirmation` means the venue has not yet returned final approval.
- `confirmed` means the venue partner has accepted.
- `declined` means the venue partner has declined or capacity is not available.
- `needs more info` means WTW needs a missing detail before routing.

## 7. First Build Recommendation

Build the private operator assistant first.

The first useful version should:
- summarize requests
- draft partner notes
- draft member replies
- scan copy risk
- produce a queue summary

Do not start with public automation.
Do not start with a member-facing autonomous agent.
Do not start with a full booking bot.

The goal is operational leverage, not theatrics.

## 8. Future App Direction

Sequence:
1. Website first
2. PWA or mobile-app feel next
3. Real App Store app later

Guidance:
- The bot should support the operating system before it becomes public-facing.
- Keep the first version private and operator-led.
- Add member-facing surfaces only after the routing model is stable.
- Keep the product honest about what is automated and what still needs review.

## Working Notes

- WTW should always read as premium, nightlife-aware, and concise.
- The system should route confidence, not manufacture certainty.
- When in doubt, prefer review language over finality language.
