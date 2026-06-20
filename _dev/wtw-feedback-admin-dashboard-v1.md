# WTW Feedback Admin Dashboard v1

## 1. Purpose
The admin Feedback dashboard should give WTW a private operating view of post-night quality.

Admin needs this dashboard to:

- Review post-night feedback in one place
- Detect bad venue or partner experiences early
- Track WTW Signal quality over time
- Support better Wave Pass routing
- Support future WTW Bot reporting

This dashboard is internal. It should help Kwame/admin make better routing and partner decisions without turning private member feedback into public reviews.

## 2. Admin Dashboard Sections
Planned sections:

- Feedback overview: top-line quality metrics and review volume
- Recent feedback: latest submitted feedback across all sources
- Low-score alerts: ratings at or below the internal concern threshold
- Venue performance: venue-level averages and patterns
- City performance: city-level averages and routing quality
- Private notes: internal notes requiring operator review
- Token status: active, used, expired, and revoked feedback tokens
- Weekly digest: summary of the week by city, venue, source, and concern areas

## 3. Key Metrics
Admin should be able to see:

- Total feedback count
- Average overall rating
- Average door flow
- Average vibe
- Average service
- Would-return percentage
- Low-score count
- Flagged feedback count
- Pending/unreviewed count

Recommended definitions:

- Low score: any score at or below 2
- Pending/unreviewed: `status = 'new'`
- Flagged: `status = 'flagged'`
- Would-return percentage: `yes` responses divided by all feedback with a return-intent response

## 4. Table Columns
Recommended feedback table columns:

- `submitted_at`
- `city`
- `venue_name`
- `event_name`
- `source_type`
- `overall_rating`
- `door_flow_rating`
- `vibe_rating`
- `service_rating`
- `would_return`
- `best_for_tags`
- `status`
- `private_note` preview

The table should favor quick scanning. Full private notes should open in a drawer or detail panel, not take over the main table.

## 5. Admin Actions
Planned actions:

- Mark reviewed
- Flag feedback
- Archive feedback
- Copy partner note draft
- Copy member follow-up draft
- View full private note

Notes:

- Partner note drafts should summarize operational issues without exposing raw private complaints by default.
- Member follow-up drafts should be private, polite, and specific to the guest experience.
- Status changes should be logged later if activity logging expands to feedback records.

## 6. Privacy Rules
- Private notes stay internal.
- User contact should be hidden by default.
- Partners cannot edit ratings.
- Partners should not see raw private complaints.
- Public WTW Signal uses summaries only.
- Do not publish names, contact details, or raw private notes.
- Public-facing claims must be curated and approved by WTW.

Admin can use raw feedback for routing and partner review, but public pages should only receive controlled summaries after review.

## 7. WTW Bot Reporting Connection
The Feedback dashboard should eventually power bot answers such as:

- How many reviews do we have?
- Which venues had bad feedback?
- Which city is strongest?
- Show feedback from this week.
- Which partners need attention?

The bot should work from admin-approved feedback access, summary views, or scoped reporting functions. It should not publish raw private notes, user contact, or unreviewed complaints.

Useful future bot inputs:

- Feedback count by date range
- Average ratings by venue
- Average ratings by city
- Low-score feedback list
- Flagged feedback list
- Weekly feedback digest
- Token send/use rate

## 8. MVP Build Recommendation
The safest first build is either:

- A static admin feedback mock using placeholder data, or
- Admin planning only until live Supabase feedback tables and RLS are applied.

Do not add live Supabase writes in the admin dashboard MVP. Do not add token validation yet. Do not expose feedback to partners yet.

The first admin UI should prove the operator workflow: review, flag, archive, scan venue quality, and understand weekly patterns.

## 9. Recommended Next Loop
The next safest implementation step is a read-only admin dashboard implementation plan.

Recommended scope:

- Inspect existing `admin.html` tab/layout patterns
- Decide where Feedback fits in admin navigation
- Define static placeholder data shape
- Plan a mock-only Feedback tab without Supabase reads/writes
- Keep `feedback.html`, Supabase, token validation, email/SMS, and partner visibility untouched

Recommended allowed file for that next planning loop:

- `_dev/wtw-feedback-admin-build-plan-v1.md`
