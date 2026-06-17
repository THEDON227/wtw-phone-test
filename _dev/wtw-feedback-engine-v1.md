# WTW Feedback Engine v1

## 1. Purpose
WTW needs a private feedback engine to improve routing quality, protect member experience, and give the operator team visibility into what actually works.

The system should:
- Improve venue and event routing over time
- Detect weak partners and rooms early
- Power WTW Signal scores and member guidance
- Give Kwame and the bot a clear operating view of quality
- Turn raw post-event feedback into usable internal intelligence

This is not a public review platform. It is a private operating tool for WTW.

## 2. Feedback Collection Flow
Ideal flow:
1. A user submits a ticket, reservation, table request, or Wave Pass request
2. The request is confirmed
3. After the event or reservation time passes, WTW sends a follow-up
4. The user responds through simple click-based answers
5. Feedback is saved privately
6. WTW and the bot summarize the results for operator use

The flow should feel lightweight. It should not add friction to the booking experience.

## 3. Feedback Questions
Feedback should use simple, click-based questions:
- Overall experience
- Door or reservation flow
- Crowd or vibe
- Service
- Would you go back?
- Best for tags
- Optional private note

Recommended response shapes:
- 1 to 5 rating scales
- Yes / No / Maybe return intent
- Tag chips for venue fit
- One optional text field for context

## 4. Data Model Draft
Future `experience_feedback` table draft:

- `id`
- `request_id` or `order_id`
- `source_type` (`ticket`, `reservation`, `table`, `wave_pass`)
- `user_contact`
- `city`
- `venue_name`
- `event_name`
- `experience_date`
- `overall_rating`
- `door_flow`
- `vibe_rating`
- `service_rating`
- `would_return`
- `best_for_tags`
- `private_note`
- `submitted_at`

Notes:
- Keep contact data private
- Keep private notes internal only
- Normalize scores so WTW Signal can aggregate cleanly

## 5. Email / SMS Follow-Up Model
The follow-up system should start with email and add SMS later.

Guidance:
- Email first for lower friction and lower cost
- SMS later for high-value or time-sensitive follow-ups
- Use one-click answers in email
- Point all responses to a simple `feedback.html` landing page when needed
- Keep reminders limited and tasteful

The goal is response quality, not spam volume.

## 6. Admin + Bot Reporting
Future bot questions Kwame should be able to ask:
- How many reviews do we have?
- Which venues are trending up?
- Which venues had complaints?
- What is the average door flow score?
- Which city has the best feedback?
- Show me bad feedback this week
- Summarize today’s site and request activity

The bot should summarize patterns, not make public claims without review.

## 7. Public Display Rules
Initial rule set:
- No raw public reviews at first
- WTW converts feedback into curated internal signals
- Surface only controlled outputs like WTW Signal % and Best For tags
- Member feedback highlights can be shown later if approved
- Private complaints stay internal

Public display should always be curated and operator-controlled.

## 8. Safety + Privacy Rules
Core rules:
- Do not publish names or contact info
- Do not expose private notes publicly
- Partners cannot directly edit ratings
- WTW controls what becomes public
- The bot can summarize but cannot publish without approval

Additional guardrails:
- Keep feedback access scoped to internal operators
- Separate public curation from internal quality data
- Preserve the ability to suppress sensitive feedback

## 9. MVP Build Order
Recommended build phases:

1. Blueprint only
2. `feedback.html` static form
3. Supabase feedback table
4. Manual feedback email links
5. Automated post-event email
6. Admin feedback dashboard
7. WTW Bot reporting

This sequence keeps the system simple, testable, and safe.

## 10. Recommended Next Loop
Build `feedback.html` as a static internal/public-facing form shell first, with no automation and no backend write logic yet. That gives a concrete surface to design around before the data model and automation work begin.

