# WTW Super Operator Bot Full Capability Pack v1

## 1. Purpose
This is the full capability roadmap for the WTW Super Operator Bot, a private AI assistant for Kwame to manage WTW from phone or text.

The goal is to make WTW easier to run, easier to inspect, and safer to operate while keeping control in Kwame’s hands.

## 2. North Star
Kwame should be able to run WTW from his phone without needing his laptop, while still protecting the site, data, partners, customers, and brand.

## 3. Current Bot State
- Local terminal simulator exists
- Mock assistant data works
- Readiness and status commands work
- Telegram is not connected yet
- No live Supabase data yet
- No edit/deploy workflow yet

## 4. Future Bot Modes

### READ MODE
Bot only reads and reports.

### DRAFT MODE
Bot turns Kwame’s message into a safe Codex prompt, GitHub issue, or task brief.

### BUILD MODE
Later, Codex and GitHub workflow can implement changes on a draft branch.

### REVIEW MODE
Bot summarizes files changed, QA results, screenshots, and risks.

### APPROVAL MODE
Only after an explicit approval phrase can a change move toward push or deploy.

## 5. Capability Map

### A. Website Control
- fix header
- fix mobile layout
- edit homepage copy
- update page section
- check broken links
- check page health
- check Safari/mobile readiness
- create rollback plan

### B. Event Management
- add event
- edit event title
- edit date/time
- edit city
- edit event description
- edit ticket price
- edit ticket types
- edit guest list language
- edit VIP/table language
- mark event high-interest/curated
- hide/retire event
- check event detail page

### C. Ticket / Revenue Intelligence
- tickets sold
- tickets pending
- inventory remaining
- revenue estimate
- high-demand events
- low-demand events
- ticket changes needing approval
- price update request

### D. Indulge / Restaurant Management
- add restaurant/venue
- edit restaurant description
- edit typical spend
- edit vibe
- edit city
- edit reservation copy
- hide/retire restaurant
- check dinner-to-night routing

### E. Partner / Outreach CRM
- show targets
- track outreach
- draft DM
- draft email
- follow-up reminders
- log interest level
- meeting notes
- partner pilot checklist
- investor intro
- restaurant pitch
- club pitch

### F. Operations / Admin
- summarize requests
- reservations pending
- guest list pending
- VIP pending
- Wave Pass requests
- partner applications
- feedback summary
- tonight brief
- weekend brief
- daily operator brief

### G. Presentation / Investor Mode
- presentation readiness
- demo script reminder
- live vs planned summary
- investor talking points
- club owner talking points
- restaurant talking points
- objections/answers
- market target summary

### H. QA / Safety
- run repo status
- run QA scan
- run pre-commit check
- check redirects
- check mobile overflow
- check trust language
- check venue-name risk
- check dead CTAs
- check bot commands

### I. GitHub / Codex Workflow
- make Codex prompt
- create GitHub issue later
- create branch later
- run checks later
- summarize diff later
- generate PR description later
- approval-based merge/push later

### J. Emergency / Recovery
- site down check
- broken page report
- rollback plan
- last good commit
- freeze public site
- hold all changes
- incident summary

## 6. Command System

### READ
- /status
- /score
- /brief
- /tonight
- /tickets
- /money
- /events
- /restaurants
- /reservations
- /vip
- /wavepass
- /feedback
- /presentation_ready
- /docs
- /targets
- /outreach
- /tracker

### DRAFT
- /make_prompt
- /draft_edit
- /draft_event
- /draft_price
- /draft_header_fix
- /draft_mobile_fix
- /draft_copy
- /draft_outreach
- /draft_followup
- /draft_issue

### REVIEW
- /diff
- /qa
- /preview
- /risk
- /what_changed
- /ready_to_push

### APPROVAL
- /approve_draft
- /approve_issue
- /approve_push
- /reject
- /hold
- /rollback_plan

## 7. Natural Language Requests
Kwame should be able to text normal language like:

- Fix the events page header on mobile
- Change the Friday event price to 40
- Add a Miami dinner-to-club event for Saturday
- Make this restaurant description sound more luxury
- Run QA and tell me if the site is safe
- Give me the outreach message for a rooftop in Jersey City
- Who should I follow up with today?
- Make a Codex prompt for this

The bot should classify the request and ask clarification only when needed.

## 8. Request Classification
- site_visual_fix
- site_copy_update
- event_create
- event_update
- event_price_update
- indulge_update
- outreach_task
- qa_request
- readiness_request
- business_data_request
- deployment_request
- unknown_request

## 9. Clarifying Questions

### Event price update
- Which event?
- Which city/date?
- Which ticket type?
- Current price?
- New price?
- Should fees/taxes change?
- Should public copy change?

### Site visual fix
- Which page?
- Mobile or desktop?
- What looks wrong?
- Is there a screenshot?
- Should this be presentation-safe only or permanent?

## 10. File Safety Map

### Public site
- index.html
- events.html
- all-events.html
- event-detail.html
- indulge.html
- indulge-detail.html
- pass.html
- partners.html
- feedback.html

### Support pages
- confirmation.html
- qr-checkin.html
- reservation-submitted.html

### Bot files
- scripts/wtw-operator-bot-sim.mjs
- _dev/mock/wtw-assistant-mock-data.json

### Docs
- _dev/*.md

### Locked unless explicitly approved
- supabase-client.js
- supabase-config.js
- SQL/RLS files
- admin.html
- partner-dashboard.html
- auth/login logic
- QR/check-in logic
- payment/ticketing logic
- email/SMS delivery logic

## 11. Approval Language
Strict approval phrases:

- APPROVE DRAFT
- APPROVE ISSUE
- APPROVE BUILD
- APPROVE PUSH
- APPROVE ROLLBACK
- REJECT
- HOLD

“ok,” “yes,” “cool,” or “do it” are not enough for a production push.

## 12. Edit Workflow From Phone
1. Kwame texts request.
2. Bot classifies request.
3. Bot asks missing details.
4. Bot creates change plan.
5. Bot identifies files.
6. Bot creates Codex prompt.
7. Kwame approves draft.
8. Codex makes change.
9. QA runs.
10. Bot summarizes diff.
11. Kwame approves push.
12. Change goes live.

## 13. Codex Integration Vision
- Bot generates Codex prompts for manual use first
- Later bot creates GitHub issue
- Later bot creates branch
- Later Codex / GitHub Actions can implement
- Bot reports result back to Telegram
- No merge or push without approval

## 14. GitHub Workflow
- issue creation
- branch creation
- draft PR
- QA checks
- preview link later
- approval phrase
- merge / push
- rollback plan

## 15. Supabase Workflow
- Read-only first
- Protected server endpoint later
- No service role key exposed
- Event / ticket / request data later comes from Supabase
- Writes require admin approval
- Price updates should eventually use admin dashboard, not raw HTML

## 16. Telegram Architecture
- Telegram receives messages
- Allowlist checks Kwame’s user ID
- Command handler processes request
- Bot replies with safe plan
- Later queues approved tasks
- Logs all actions

## 17. Security Rules
- Private bot only
- Allowlist user ID
- No secrets in repo
- No service role key in client
- No auto-production deploys
- Audit log every request
- Rate limit commands
- Redact customer phone/email in summaries
- Never expose customer data in group chats

## 18. Audit Log
Fields:

- timestamp
- user
- command
- request type
- files involved
- approval status
- action taken
- commit / PR link later
- result

## 19. Road Mode Use Cases
- walking into a meeting
- on phone with a venue owner
- in Uber before a pitch
- promoter asks for event update
- restaurant asks how requests route
- investor asks readiness
- site looks broken on phone
- someone sends screenshot of issue
- Kwame needs follow-up message fast

## 20. Example Conversations

### A. Fix header from phone
Kwame: Fix the events page header on mobile.

Bot: Which page, what device width, and what exactly is clipping?

### B. Update event price
Kwame: Change the Friday event price to 40.

Bot: Which event, which ticket type, and should this be draft-only or ready for approval?

### C. Add event
Kwame: Add a Miami dinner-to-club event for Saturday.

Bot: What is the title, city area, date, venue name, and status?

### D. Edit restaurant copy
Kwame: Make this restaurant description sound more luxury.

Bot: Paste the current copy and tell me whether this is for Indulge or a specific detail page.

### E. Check tonight’s ticket numbers
Kwame: Check tonight’s ticket numbers.

Bot: Pulling current totals and pending counts.

### F. Draft outreach DM
Kwame: Draft outreach DM for a rooftop in Jersey City.

Bot: I’ll draft a concise outreach message and keep it internal.

### G. Run presentation readiness
Kwame: Run presentation readiness.

Bot: Here are the current readiness scores and any gaps.

### H. Create Codex prompt
Kwame: Make a Codex prompt for this.

Bot: I’ll turn it into a safe prompt with files, goal, and validation.

### I. Review diff and approve push
Kwame: Review diff and approve push.

Bot: I’ll summarize the changes, QA, and risk, then wait for the approval phrase.

### J. Rollback plan
Kwame: Rollback plan for the last deploy.

Bot: I’ll identify the last good commit and outline the rollback steps.

## 21. What Bot Must Never Promise
- guaranteed entry
- guaranteed tables
- confirmed access
- official partner
- verified partner
- final pricing
- instant approval
- customer confirmation without partner approval

## 22. Full Build Roadmap
- Phase 1: Full capability pack
- Phase 2: Local draft command simulator
- Phase 3: Shared command handler
- Phase 4: Telegram read-only bot
- Phase 5: Telegram draft/edit request mode
- Phase 6: GitHub issue / branch workflow
- Phase 7: QA / preview reporting
- Phase 8: Approval-based push / deploy
- Phase 9: Supabase read-only data
- Phase 10: Admin-approved writes

## 23. Next Implementation Step
Extend the local bot simulator with draft request commands:

- /draft_edit
- /draft_event
- /draft_price
- /draft_mobile_fix
- /draft_outreach

These should generate structured prompts only and make no edits.
