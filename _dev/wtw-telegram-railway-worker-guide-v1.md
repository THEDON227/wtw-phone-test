# WTW Telegram Railway Worker Guide

## Purpose
This guide describes the private Railway worker that runs the WTW Telegram wrapper. It lets Kwame test the existing safe operator bot commands from his phone without touching the public site or backend systems.

## What The Worker Does
- Receives Telegram messages via long polling
- Routes supported commands into the local WTW Operator Bot simulator
- Returns the same read-only output the simulator produces
- Supports `/whoami` for chat ID discovery
- Enforces a private allowlist when `WTW_TELEGRAM_ALLOWED_CHAT_ID` is set

## What It Does Not Do
- Does not edit public site files
- Does not write to Supabase
- Does not send partner or customer messages
- Does not commit or push code
- Does not expose secrets

## Required Railway Variables
- `TELEGRAM_BOT_TOKEN`
- `WTW_TELEGRAM_ALLOWED_CHAT_ID`

## Railway Start Command
`npm start`

## Local Test Command
```bash
cd ~/wtw-website
TELEGRAM_BOT_TOKEN="replace_me" npm start
```

## Safety Rules
- No Supabase
- No public site edits
- No auto-push
- No partner/customer messages
- No secrets committed

## First Telegram Tests
- `/whoami`
- `/help`
- `/status`
- `/draft_outreach restaurant partner in Miami`

## Rollback Note
If the cloud worker misbehaves, stop the Railway service or remove the `TELEGRAM_BOT_TOKEN` variable.
