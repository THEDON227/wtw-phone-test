# WTW Assistant Data Brain v1

## 1. Purpose
The WTW Assistant is Kwame’s private owner/operator assistant for managing WTW from a phone or text interface.

It should help him answer business questions quickly, understand what is happening across WTW, and decide the next safest move without digging through the repo or dashboards.

## 2. Difference From Current Bot Simulator
The current simulator checks repo state, QA, readiness, and commit history.

The future assistant should know business data.

It should answer operational questions about events, tickets, restaurants, reservations, partners, revenue, Wave Pass, and presentation readiness.

## 3. Core Data Areas
The assistant should eventually understand:

- Events
- Event dates and times
- Event cities
- Event status
- Ticket inventory
- Tickets sold
- Tickets requested
- Guest list requests
- VIP / table requests
- Indulge venues and restaurants
- Reservation requests
- Partner assignments
- Wave Pass members and requests
- Partner applications
- Feedback and reviews
- Revenue estimates
- Admin tasks
- Presentation readiness

## 4. Truth Hierarchy
The assistant should use a clear source priority.

1. Supabase live tables
2. Admin dashboard status
3. Partner confirmations
4. Static site event and venue data
5. Manual notes
6. Mock data only for testing

This hierarchy keeps the assistant grounded in the most reliable operational source available at the time.

## 5. Suggested Commands v2

### /today
- What Kwame texts: `/today`
- What the assistant checks: the current day’s key events, reservations, requests, and deadlines
- What the assistant replies with: a short operational summary for today

### /tonight
- What Kwame texts: `/tonight`
- What the assistant checks: tonight’s events, guest lists, VIP requests, and Indulge activity
- What the assistant replies with: a concise night-of brief with the main opportunities and risks

### /weekend
- What Kwame texts: `/weekend`
- What the assistant checks: upcoming Friday through Sunday inventory and requests
- What the assistant replies with: a weekend planning summary

### /events
- What Kwame texts: `/events`
- What the assistant checks: the live event list
- What the assistant replies with: a sorted summary of current events

### /event EVENT_ID
- What Kwame texts: `/event EVT123`
- What the assistant checks: one specific event’s details
- What the assistant replies with: a focused event brief with inventory, requests, and status

### /tickets
- What Kwame texts: `/tickets`
- What the assistant checks: total ticket inventory, sold, and pending numbers
- What the assistant replies with: a high-level ticket overview

### /tickets EVENT_ID
- What Kwame texts: `/tickets EVT123`
- What the assistant checks: one event’s ticket inventory and sales
- What the assistant replies with: an event-specific ticket summary

### /sold
- What Kwame texts: `/sold`
- What the assistant checks: tickets sold across active events
- What the assistant replies with: a sales snapshot

### /inventory
- What Kwame texts: `/inventory`
- What the assistant checks: remaining inventory across active events
- What the assistant replies with: an inventory snapshot

### /guestlist
- What Kwame texts: `/guestlist`
- What the assistant checks: guest list requests and their status
- What the assistant replies with: a guest list summary

### /vip
- What Kwame texts: `/vip`
- What the assistant checks: VIP and table requests
- What the assistant replies with: a VIP routing summary

### /restaurants
- What Kwame texts: `/restaurants`
- What the assistant checks: Indulge venues and restaurant status
- What the assistant replies with: a dining and lounge summary

### /reservations
- What Kwame texts: `/reservations`
- What the assistant checks: reservation requests across Indulge
- What the assistant replies with: a reservation routing summary

### /partners
- What Kwame texts: `/partners`
- What the assistant checks: partner assignments and active partner status
- What the assistant replies with: a partner pipeline summary

### /wavepass
- What Kwame texts: `/wavepass`
- What the assistant checks: Wave Pass members and requests
- What the assistant replies with: a Wave Pass summary

### /feedback
- What Kwame texts: `/feedback`
- What the assistant checks: recent feedback and review patterns
- What the assistant replies with: a private feedback summary

### /money
- What Kwame texts: `/money`
- What the assistant checks: revenue estimates and ticket or request value
- What the assistant replies with: a simple business snapshot

### /city CITY
- What Kwame texts: `/city NYC`
- What the assistant checks: all active items for one city
- What the assistant replies with: a city-specific operating brief

### /brief
- What Kwame texts: `/brief`
- What the assistant checks: today’s important operational items
- What the assistant replies with: a short founder/operator brief

### /presentation_ready
- What Kwame texts: `/presentation_ready`
- What the assistant checks: public readiness, mobile safety, trust cleanup, backend stability, and demo readiness
- What the assistant replies with: a readiness summary for presentation use

### /make_prompt
- What Kwame texts: `/make_prompt fix mobile pass page`
- What the assistant checks: the task request and current context
- What the assistant replies with: a safe Codex prompt draft Kwame can run manually

## 6. Example Replies

### /tonight
Tonight:
- 3 active events in New York
- 2 guest list requests still pending
- 1 VIP/table request waiting for routing
- Indulge has 4 reservations in review

### /tickets
Tickets:
- 4 active events
- 182 sold
- 61 remaining
- 9 pending requests

### /restaurants
Restaurants:
- 6 active Indulge spots
- 3 reservation requests pending
- 2 partner assignments need review

### /money
Money:
- Estimated gross tonight: $8.4K
- Tickets are the strongest line
- VIP/table requests could raise the ceiling if confirmed

### /brief
Brief:
- Events are healthy
- Mobile presentation is close
- Feedback is still planning-only
- Next safest fix is mobile overflow cleanup

### /presentation_ready
Presentation ready:
- Laptop demo: yes
- Controlled club-owner demo: yes
- Investor walkthrough: yes, if live vs planned is framed clearly
- Phone demo: almost, but mobile overflow should be cleaned first

## 7. Data Model Needed

### Events
- id
- title
- city
- date
- venue_name
- status
- capacity
- ticket_inventory
- tickets_sold
- tickets_pending
- guest_list_count
- vip_requests_count
- revenue_estimate

### Indulge venues
- id
- name
- city
- type
- vibe
- status
- reservation_requests
- partner_status

### Requests
- id
- type
- customer_name
- phone
- city
- event_or_venue
- party_size
- status
- partner_assigned
- created_at

## 8. Read-Only Safety Rules
- Assistant v1 is read-only
- No editing events
- No changing ticket counts
- No sending SMS or email
- No confirming guests
- No changing Supabase records
- No push or deploy
- Any action must generate a Codex or admin prompt first

## 9. Future Supabase Connection
Later, the assistant should read from Supabase using safe read-only access or a protected server endpoint.

No service role key should ever be exposed in Telegram or in a client-side surface.

## 10. Local Mock Data Phase
The next step should be a local mock data phase.

Recommended shape:
- create a local JSON mock data file
- update the simulator so commands like `/tickets` and `/tonight` work from mock data only
- keep Supabase out of it for now

## 11. Telegram Phase
Once the local mock commands are stable, Telegram can call the same command handler.

That keeps the command contract stable while changing only the delivery channel.

## 12. Next Implementation Step
Create local mock data and extend `scripts/wtw-operator-bot-sim.mjs` to support `/tonight`, `/tickets`, `/restaurants`, `/money`, and `/brief` using mock data only.
