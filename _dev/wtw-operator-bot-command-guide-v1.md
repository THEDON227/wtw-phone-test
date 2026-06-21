# WTW Operator Bot Command Guide v1

## 1. Purpose
The local WTW Operator Bot simulator helps Kwame generate safe WTW operating prompts.

It does not edit files.
It does not push.
It does not write to Supabase.
It does not message partners or customers.

## 2. Current Safe Draft Commands

### `/draft_edit`
Use for copy, layout, or text edits.

Example:
`/draft_edit fix the Events page hero headline spacing on mobile`

### `/draft_event`
Use for event creation or event updates.

Example:
`/draft_event add rooftop event in NYC for July 4`

### `/draft_price`
Use for visible pricing, spend language, or ticket copy updates.

Example:
`/draft_price change Wave Pass to $27/month`

### `/draft_mobile_fix`
Use for mobile layout issues, overflow, clipping, or hero behavior.

Example:
`/draft_mobile_fix Indulge cards overflow on Safari`

### `/draft_outreach`
Use for internal outreach message drafts for venues, restaurants, promoters, hosts, hospitality groups, or investors.

Example:
`/draft_outreach restaurant partner in Miami`

## 3. Approval Language
Strict approval phrases:

- APPROVE DRAFT
- APPROVE ISSUE
- APPROVE BUILD
- APPROVE PUSH
- APPROVE ROLLBACK
- REJECT
- HOLD

Vague approvals like “ok,” “yes,” “cool,” or “looks good” are not enough for production changes.

## 4. Safe Workflow
Kwame text/request  
→ Bot generates draft  
→ Kwame reviews  
→ Codex builds only after clear approval  
→ QA passes  
→ Kwame approves push using APPROVE PUSH  
→ push live

## 5. What the Bot Must Never Do
- No random live edits
- No auto-push to main
- No Supabase writes without approval
- No emails, SMS, or customer messages without approval
- No partner confirmations without approval
- No guaranteed entry or table language

## 6. WTW Language Rules
Use:
- curated
- request
- priority review
- partner confirmation
- access subject to availability

Avoid:
- guaranteed entry
- guaranteed table
- verified partner
- official partner
- instant confirmation
- confirmed availability unless truly confirmed
