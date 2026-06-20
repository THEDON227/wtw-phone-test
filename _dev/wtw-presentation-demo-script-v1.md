# WTW Presentation Demo Script v1

## 1. One-Sentence Pitch
WTW is a luxury nightlife operating system that turns nightlife demand into curated access, cleaner routing, and better decisions for events, dining, Wave Pass, and partners.

## 2. 30-Second Intro
WTW helps nightlife move with less noise and more intention.

Instead of scattered DMs, fragmented guest lists, and disconnected reservation requests, WTW gives you a curated layer for events, dining, Wave Pass, and partner routing.

It is built to show demand clearly, route requests cleanly, and help owners understand what is moving before the night gets messy.

## 3. 3-Minute Demo Script
Start on the homepage.

Explain that the homepage is the front door for WTW: what is happening, where the night starts, and how access gets routed.

Move to Events.
Show that WTW is not a generic flyer wall. It is curated nightlife intelligence with request access and concierge routing.

Open an Event Detail page.
Point out request flow, access layers, and how WTW helps organize guest list and table demand.

Move to Indulge.
Explain dinner-to-night planning and how WTW connects restaurants, lounges, and the night after dinner.

Open an Indulge Detail page.
Show reservation routing and premium dining discovery.

Open Wave Pass.
Explain it as the priority/access layer.

Open Partners.
Show that WTW is building a network, not just a set of listings.

Open Feedback.
Explain that WTW is designed to learn from the night, not just sell the night.

Finish in the Operator Bot simulator.
Show that WTW can already report readiness and mock operational state from the phone.

## 4. 10-Minute Demo Script

### `index.html`
This is the home base.

Say:
- WTW is a nightlife operating system, not just an event site
- The homepage shows the current city, the active access layers, and the request flow
- The goal is to route demand into the right lane instead of letting it sprawl across DMs

### `events.html`
This is the curated event layer.

Say:
- WTW shows what is moving tonight
- Users can request access instead of just browsing static cards
- The focus is curated nightlife intelligence with priority review

### `all-events.html`
This is the full discovery surface.

Say:
- This is the broader inventory view
- It helps users compare options without losing the premium WTW tone
- It is still organized around routing, not just cataloging

### `event-detail.html`
This is where demand becomes action.

Say:
- Guests can request access, guest list entry, or table routing
- WTW organizes request types cleanly
- This reduces promoter chaos and gives owners a clearer picture of demand

### `indulge.html`
This is where the night starts.

Say:
- WTW covers restaurants, lounges, and dinner-to-night planning
- The user experience connects dinner plans to the rest of the night
- This is especially useful for birthdays, groups, and pre-night planning

### `indulge-detail.html`
This is the reservation routing layer.

Say:
- Each spot can route reservation interest cleanly
- The focus is premium discovery and easier booking flow
- WTW keeps the experience aligned with nightlife, not generic restaurant search

### `pass.html`
This is Wave Pass.

Say:
- Wave Pass is the priority/access layer
- It is a way to create an owned relationship with the audience
- It can later support recurring value, exclusivity, and demand routing

### `partners.html`
This is the network layer.

Say:
- WTW is building a partner network around the product
- This is how the system becomes more useful over time
- The partner layer matters because WTW is not only showing inventory; it is coordinating it

### `feedback.html`
This is the learning layer.

Say:
- WTW wants to learn from the night, not just route the night
- Feedback helps identify where experiences are strong or weak
- That will later feed the operator and partner intelligence layer

### `confirmation.html` / `qr-checkin.html`
This is the support layer.

Say:
- Confirmation and QR surfaces support the experience after a request is made
- They are part of the operational flow, not just visual polish

### Bot simulator commands
Finish by showing the local operator bot simulator.

Say:
- This is the current private command layer
- It is read-only and mock-data based for now
- It already shows the shape of the future assistant

## 5. Club Owner / Promoter Version
WTW helps club owners and promoters by:

- organizing requests
- routing guest list and table demand
- reducing messy promoter texting
- showing demand clearly
- collecting feedback from the night
- creating a premium access layer that feels intentional

Say:
WTW gives you a cleaner operating system for demand. Instead of chasing messages, you see what people want, route it properly, and keep the room feeling premium.

## 6. Restaurant / Lounge Version
WTW helps restaurants and lounges by:

- turning dinner into the start of the night
- supporting birthday and group planning
- cleanly handling reservation requests
- making discovery more premium
- collecting post-experience feedback

Say:
WTW helps people move from dinner into the rest of the night without making the experience feel fragmented.

## 7. Investor Version
WTW solves a fragmented nightlife coordination problem.

The market problem:
- demand is real, but it is scattered
- the customer journey is split across discovery, requests, confirmations, and post-night feedback
- operators need a cleaner way to see and route that demand

The product wedge:
- premium public experience
- request routing
- Wave Pass
- partner network
- feedback learning loop

The operating system vision:
- WTW becomes the layer that helps nightlife discover, route, confirm, and learn

Revenue paths:
- Wave Pass
- partner network value
- premium access routing
- later ticketing and automation

What is live now vs planned:
- live now: public site, request flows, feedback MVP, operator bot simulator
- planned next: live feedback backend, Telegram owner bot, deeper Supabase connection, and automation

## 8. Live Now vs Coming Next
### LIVE NOW
- public website
- event discovery and request flows
- Indulge reservation request flow
- Wave Pass request page
- partner application page
- confirmation and QR surfaces
- feedback MVP page
- local operator bot simulator with mock data

### COMING NEXT
- live feedback backend
- Telegram owner bot
- Supabase live data connection
- partner dashboard polish
- payment and ticketing hardening
- domain, legal, and trust pages
- full automation

## 9. Demo Route
Use this click path:

Home → Events → All Events → Event Detail → Indulge → Indulge Detail → Wave Pass → Partners → Feedback → Bot commands

## 10. Bot Demo Commands
Use these commands in the terminal:

```bash
node scripts/wtw-operator-bot-sim.mjs /status
node scripts/wtw-operator-bot-sim.mjs /score
node scripts/wtw-operator-bot-sim.mjs /presentation_ready
node scripts/wtw-operator-bot-sim.mjs /tonight
node scripts/wtw-operator-bot-sim.mjs /tickets
node scripts/wtw-operator-bot-sim.mjs /money
node scripts/wtw-operator-bot-sim.mjs /brief
```

Say clearly:
`Mock local data — not live Supabase yet.`

## 11. Questions To Be Ready For

### Is this live?
The public site is live. The deeper data automation is still being built, and the operator bot currently uses mock local data.

### Do you have venue partners yet?
WTW is building the network now. The product is designed to route demand cleanly while the partner layer grows.

### Is entry guaranteed?
No. Access always depends on partner confirmation and the availability of the night.

### How does WTW make money?
Wave Pass, premium access routing, and later partner/network value are the main paths.

### What is Wave Pass?
It is the priority/access layer for people who want a stronger relationship with WTW.

### What makes this different from Eventbrite?
WTW is not a generic event listing tool. It is curated nightlife intelligence and request routing for the actual night.

### What makes this different from promoters?
WTW is the operating layer, not just a person handling messages. It helps systematize demand and keep the experience premium.

### What data will the bot know later?
It will know events, tickets, reservations, partners, feedback, revenue estimates, and presentation readiness from the operational layer.

### What do you need from a partner?
Clear confirmations, accurate routing expectations, and a willingness to work inside a cleaner WTW flow.

### What is the next milestone?
Connect live feedback and operational data to the assistant, then move toward a private Telegram owner bot.

## 12. Closing Pitch
WTW is building the operating system for nightlife demand.

It starts with clean presentation, request routing, and premium access. Over time, it becomes the layer that helps owners, promoters, restaurants, and guests move through the night with less noise and better intelligence.

That is the product: curated nightlife intelligence, concierge routing, and a stronger operating system for the night.
