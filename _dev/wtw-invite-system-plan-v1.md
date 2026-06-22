# WTW Invite System Plan v1

## Purpose
Plan a future invite/access system that supports WTW without making public access automatic.

## What the invite system is for
- Wave Pass invite codes.
- Partner invite codes.
- Priority review / access lane handling.
- Manual approval and manual outreach tracking.

## Safe statuses
- draft
- active
- used
- expired
- revoked

## Possible future bot commands
- `/invite_status`
- `/pending_invites`
- `/draft_invite Miami restaurant`

## Approval flow
1. Draft the invite.
2. Review the invite request.
3. Approve it manually.
4. Send the invite manually.
5. Record status changes.
6. Track reply or redemption.

## Safety rules
- No automatic public approvals.
- No guaranteed entry.
- No guaranteed tables.
- Invite means priority review or access lane, not confirmed access.
- No automatic customer messages.
- No secrets committed.

## Future data shape
- Invite code
- Invite type
- Target market
- Target business or member
- Status
- Issued at
- Expires at
- Redeemed at
- Notes
