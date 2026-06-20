# WTW Operator Bot v1

## 1. Purpose
The WTW Operator Bot is a private command assistant for Kwame to monitor and manage WTW from a phone while on the move.

Its job is to make it easy to check site health, understand what changed, review readiness, and generate the next Codex prompt without opening the full repo every time.

## 2. Core Principle
The bot is read-only by default.

It does not auto-edit files.
It does not auto-commit.
It does not auto-push.
It does not make backend changes without explicit approval.

All write actions must stay approval-gated and should flow through Codex prompts first.

## 3. Best First Channel
Telegram is the best first channel.

It is fast, private, and cheaper to prototype than full SMS. It also makes command-style interaction easier during early testing.

Twilio SMS can come later for true texting once the command contract is stable.

## 4. Bot Commands v1

### /status
- What Kwame texts: `/status`
- What the bot checks: current repo state, latest commit, branch status, and whether the worktree is clean
- What the bot replies with: a short summary of current WTW state and whether anything is pending
- Mode: read-only

### /qa
- What Kwame texts: `/qa`
- What the bot checks: current QA scan results and safety checks
- What the bot replies with: pass/fail summary plus the main warnings, if any
- Mode: read-only

### /score
- What Kwame texts: `/score`
- What the bot checks: the latest readiness assessment
- What the bot replies with: WTW readiness scores across public site, mobile, Safari/Chrome, backend, feedback, admin, and bot readiness
- Mode: read-only

### /pages
- What Kwame texts: `/pages`
- What the bot checks: the current public page map
- What the bot replies with: a list of active pages and legacy redirects
- Mode: read-only

### /what_changed
- What Kwame texts: `/what_changed`
- What the bot checks: the latest committed diff summary
- What the bot replies with: a concise list of what changed in the last checkpoint
- Mode: read-only

### /make_prompt
- What Kwame texts: `/make_prompt fix mobile pass page`
- What the bot checks: the requested task and the current WTW context
- What the bot replies with: a ready-to-run Codex prompt that Kwame can paste into Codex manually
- Mode: read-only output, no repository changes

### /presentation_ready
- What Kwame texts: `/presentation_ready`
- What the bot checks: public-facing polish, trust language, venue-name risk, mobile readiness, and browser safety
- What the bot replies with: a simple yes/no style readiness call plus the most important blocker if one exists
- Mode: read-only

### /live_check
- What Kwame texts: `/live_check`
- What the bot checks: whether the site is up, whether the latest checkpoint is present, and whether key pages are reachable
- What the bot replies with: live-site health summary
- Mode: read-only

### /help
- What Kwame texts: `/help`
- What the bot checks: available commands
- What the bot replies with: a short command list and one-line descriptions
- Mode: read-only

## 5. Safety Rules
- Never push without Kwame approval.
- Never edit files directly in v1.
- Never expose API keys.
- Never send Supabase secrets.
- Never modify SQL or RLS.
- Never send emails or SMS to users.
- Never change admin or partner logic without explicit approval.
- All changes should go through Codex prompts first.

## 6. Future Approval Flow
Example:

Kwame texts: `/make_prompt fix mobile pass page`

The bot returns a Codex prompt that describes the exact task and guardrails.

Kwame then runs Codex manually.

After Codex finishes, the bot can later verify the result with a read-only status check.

## 7. Future Architecture
Start simple.

- Telegram Bot API first
- Small Node or Python service
- GitHub repo read access
- GitHub Actions later for cloud QA
- Supabase read-only status later
- Railway, Render, Vercel, or a Cloudflare Worker as possible hosting

## 8. What Bot Can Do Now vs Later

### Now
- Generate prompts
- Explain readiness
- Check the known roadmap
- Help decide the next safest fix

### Later
- Trigger QA workflow
- Read the latest commit
- Check live pages
- Read Supabase request counts
- Create GitHub issues
- Summarize admin requests
- Monitor presentation readiness

## 9. WTW-Specific Readiness Score Format
The bot should report WTW readiness in these categories:

- Public website presentation readiness
- Club owner demo readiness
- Investor presentation readiness
- Public launch readiness
- Mobile readiness
- Safari/Chrome safety
- Backend/Supabase safety
- Admin/partner readiness
- Feedback Engine readiness
- Operator Bot readiness
- Overall readiness

## 10. Recommended Build Phases

### Phase 1: Blueprint and command contract
Define commands, outputs, and safety rules.

### Phase 2: Local command simulator
Build a local-only version that responds to commands without touching production systems.

### Phase 3: Telegram private bot
Connect the command contract to a private Telegram bot for Kwame only.

### Phase 4: GitHub Actions QA trigger
Allow the bot to trigger or inspect QA runs later.

### Phase 5: Supabase read-only dashboard status
Add read-only status from future WTW tables or summaries.

### Phase 6: Approval-based fix workflow
Support a controlled flow where the bot generates prompts and verifies results after manual Codex work.

## 11. Next Implementation Step
Build the local command simulator first.

That gives the smallest safe path to test the command contract, response format, and readiness summaries before any real Telegram integration.
