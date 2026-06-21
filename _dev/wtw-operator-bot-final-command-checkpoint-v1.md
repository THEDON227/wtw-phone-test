# WTW Operator Bot Final Command Checkpoint

## 1. Current Status
- WTW public site is presentation-ready and frozen unless fixing a real bug.
- Operator Bot is still a local simulator.
- No Telegram or live phone bot yet.
- Simulator is read-only except local draft logging.
- No public site edits happen from bot commands.

## 2. Full Command List

### Core Commands
- `/help`
- `/status`
- `/logs`
- `/next`

### Draft Operating Commands
- `/draft_edit`
- `/draft_event`
- `/draft_price`
- `/draft_mobile_fix`
- `/draft_outreach`

### Workflow Commands
- `/issue_draft`
- `/build_draft`
- `/qa_draft`
- `/push_draft`
- `/rollback_draft`

## 3. Safe Workflow
Kwame request  
→ `/issue_draft`  
→ `/build_draft`  
→ Codex builds only after `APPROVE BUILD`  
→ `/qa_draft`  
→ `/push_draft`  
→ Kwame `APPROVE PUSH`  
→ push live  
→ `/rollback_draft` only if needed

## 4. Approval Language
Valid strict phrases:
- `APPROVE DRAFT`
- `APPROVE ISSUE`
- `APPROVE BUILD`
- `APPROVE PUSH`
- `APPROVE ROLLBACK`
- `REJECT`
- `HOLD`

Vague approvals like “ok,” “yes,” “cool,” or “looks good” are not enough for production changes.

## 5. What the Simulator Must Never Do
- No random live edits
- No auto-push to main
- No Supabase writes without approval
- No emails/SMS/customer messages without approval
- No partner confirmations without approval
- No guaranteed entry/table language
- No `git add -A`
- No `git add .`

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

## 7. Next Real-World Move
Stop expanding simulator commands for now. Switch back to outreach/business execution:
- use live presentation site
- use outreach docs
- use first 20 target list
- contact venues/restaurants/lounges/promoters
- keep public site frozen unless a real bug appears
