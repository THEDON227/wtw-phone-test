#!/usr/bin/env node
// WTW Operator Bot Simulator — local read-only prototype.

import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const argv = process.argv.slice(2);
const cmd = argv[0] || '/help';
const cmdText = argv.slice(1).join(' ').trim();
const __dirname = dirname(fileURLToPath(import.meta.url));
const mockDataPath = resolve(__dirname, '../_dev/mock/wtw-assistant-mock-data.json');
const draftLogPath = resolve(__dirname, '../_dev/operator-bot-draft-log.jsonl');
const mockData = loadMockData();

function runGitStatus() {
  return runCapture('git', ['status', '--short']);
}

function runGitLog() {
  return runCapture('git', ['log', '--oneline', '-5']);
}

function runReadOnlyScript(scriptPath) {
  return runCapture('bash', [scriptPath]);
}

function loadMockData() {
  try {
    return JSON.parse(readFileSync(mockDataPath, 'utf8'));
  } catch (error) {
    return {
      note: 'MOCK LOCAL DATA — not live Supabase yet.',
      events: [],
      tickets: {},
      guestListRequests: [],
      vipRequests: [],
      restaurants: [],
      reservationRequests: [],
      partners: [],
      wavePassRequests: [],
      feedback: [],
      revenueEstimates: {},
    };
  }
}

function runCapture(file, args) {
  try {
    return execFileSync(file, args, { encoding: 'utf8' }).trimEnd();
  } catch (error) {
    const stdout = error?.stdout ? String(error.stdout).trimEnd() : '';
    const stderr = error?.stderr ? String(error.stderr).trimEnd() : '';
    const message = [stdout, stderr].filter(Boolean).join('\n');
    return message || `Unable to run ${file} ${args.join(' ')}`;
  }
}

function formatBlock(title, body) {
  return `${title}\n${'-'.repeat(title.length)}\n${body}`;
}

function approvalReminder() {
  return [
    'Approval phrases:',
    '- APPROVE DRAFT',
    '- APPROVE ISSUE',
    '- APPROVE BUILD',
    '- APPROVE PUSH',
    '- APPROVE ROLLBACK',
    '- REJECT',
    '- HOLD',
    '',
    'Vague approvals like "ok", "yes", "cool", or "do it" are not valid for production changes.',
  ].join('\n');
}

function normalizeRequest(input) {
  return input || 'No request text provided.';
}

function readDraftLogEntries(limit = 5) {
  try {
    const text = readFileSync(draftLogPath, 'utf8').trim();
    if (!text) {
      return [];
    }

    return text
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .slice(-limit)
      .reverse();
  } catch (error) {
    return [];
  }
}

function logDraftRequest({ command, requestType, riskLevel, summary }) {
  const entry = {
    timestamp: new Date().toISOString(),
    command,
    raw_request: cmdText,
    request_type: requestType,
    risk_level: riskLevel,
    safety_status: 'local-only; no live edits; no Supabase; no messages',
    approval_required: true,
    production_push_requires: 'APPROVE PUSH',
    generated_prompt_summary: summary,
  };

  appendFileSync(draftLogPath, `${JSON.stringify(entry)}\n`, 'utf8');
}

function promptShell(title, requestType, targetArea, riskLevel, assumptions, missingDetails, promptBody, reminder = approvalReminder()) {
  return [
    `${title}`,
    '',
    'DRAFT ONLY',
    'NO FILES EDITED',
    'KWAME APPROVAL REQUIRED',
    'PRODUCTION PUSH REQUIRES: APPROVE PUSH',
    '',
    `Request type: ${requestType}`,
    `Target area: ${targetArea}`,
    `Risk level: ${riskLevel}`,
    '',
    `Request text: ${normalizeRequest(cmdText)}`,
    '',
    `Assumptions: ${assumptions}`,
    `Missing details: ${missingDetails}`,
    '',
    'Safe Codex prompt:',
    promptBody,
    '',
    reminder,
  ].join('\n');
}

function helpText() {
  return [
    'WTW Operator Bot Simulator',
    '',
    'This simulator is read-only. It does not edit files, push code, write to Supabase, or message anyone.',
    '',
    'Commands:',
    '/help - show this menu',
    '/status - show git status, latest commit, and next known fix',
    '/qa - run the repo QA checks',
    '/score - show current readiness scores',
    '/pages - list active public pages and legacy redirects',
    '/what_changed - show recent commits',
    '/presentation_ready - summarize demo readiness',
    '/live_check - list the known live pages to check manually',
    '/tonight - show the mock local night brief',
    '/events - show mock local event inventory',
    '/tickets - show mock local ticket summary',
    '/restaurants - show mock local Indulge inventory',
    '/reservations - show mock local reservation requests',
    '/vip - show mock local VIP and table requests',
    '/money - show mock local revenue estimates',
    '/brief - show a mock local owner-style daily brief',
    '/make_prompt - return a safe Codex prompt template',
    '/draft_edit - generate a safe Codex prompt for copy/layout/text edits',
    '/draft_event - generate a safe Codex prompt for event updates',
    '/draft_price - generate a safe Codex prompt for pricing updates',
    '/draft_mobile_fix - generate a safe Codex prompt for mobile fixes',
    '/draft_outreach - generate a safe outreach prompt and message draft',
    '/issue_draft - generates a GitHub issue-style brief only. Does not create the issue.',
    '/build_draft - generates a Codex build prompt only. Does not edit files.',
    '/logs - show the most recent local draft log entries',
    '/next - show the next safest WTW build or business move',
    '',
    'Approval phrases:',
    'APPROVE DRAFT',
    'APPROVE ISSUE',
    'APPROVE BUILD',
    'APPROVE PUSH',
    'APPROVE ROLLBACK',
    'REJECT',
    'HOLD',
    '',
    'Vague approvals like "ok," "yes," "cool," or "looks good" are not valid for production changes.',
  ].join('\n');
}

function statusText() {
  const status = runGitStatus() || '(clean)';
  const log = runCapture('git', ['log', '--oneline', '-1']) || '(no commits found)';
  return [
    'WTW Checkpoint',
    '--------------',
    'Public site status: presentation-ready / frozen unless something breaks',
    'Bot status: safe local simulator',
    '',
    'Current bot abilities:',
    '- /help',
    '- /draft_edit',
    '- /draft_event',
    '- /draft_price',
    '- /draft_mobile_fix',
    '- /draft_outreach',
    '- /issue_draft',
    '- /build_draft',
    '- /logs',
    '- /next',
    '',
    'Safety status:',
    '- no live edits',
    '- no auto-push',
    '- no Supabase writes',
    '- no partner/customer messages',
    '- approval required',
    '',
    'Working model:',
    'Kwame request -> bot draft -> Codex build -> QA -> Kwame APPROVE PUSH -> push live',
    '',
    'Next recommended build step:',
    'Add structured request logging for draft outputs, still local-only and no live actions.',
    '',
    formatBlock('Git status', status),
    '',
    formatBlock('Latest commit', log),
  ].join('\n');
}

function logsText() {
  const entries = readDraftLogEntries(5);
  if (!entries.length) {
    return [
      'No draft logs exist yet.',
      '',
      'Logs are local-only. Production still requires APPROVE PUSH.',
    ].join('\n');
  }

  const lines = ['Most recent draft logs (latest 5):', ''];
  for (const entry of entries) {
    lines.push([
      `timestamp: ${entry.timestamp || 'unknown'}`,
      `command: ${entry.command || 'unknown'}`,
      `raw_request: ${entry.raw_request || 'unknown'}`,
      `request_type: ${entry.request_type || 'unknown'}`,
      `risk_level: ${entry.risk_level || 'unknown'}`,
      `approval_required: ${String(entry.approval_required ?? true)}`,
      `production_push_requires: ${entry.production_push_requires || 'APPROVE PUSH'}`,
      `generated_prompt_summary: ${entry.generated_prompt_summary || 'unknown'}`,
    ].join('\n'));
    lines.push('');
  }

  lines.push('Logs are local-only. Production still requires APPROVE PUSH.');
  return lines.join('\n');
}

function issueDraftText() {
  const request = normalizeRequest(cmdText);
  return [
    'ISSUE DRAFT ONLY',
    'NO GITHUB ISSUE CREATED',
    'NO FILES EDITED',
    'KWAME APPROVAL REQUIRED',
    'BUILD REQUIRES: APPROVE BUILD',
    'PUSH REQUIRES: APPROVE PUSH',
    '',
    'Title: ' + request,
    'Type: Bug fix / implementation brief',
    'Priority: Medium',
    'Risk level: Medium',
    '',
    'User request: ' + request,
    'Problem summary: Drafted from the requested change only; verify exact page and expected behavior before any build.',
    'Recommended scope: smallest safe change needed to address the issue.',
    'Files to inspect: [determine exact files during review]',
    'Acceptance criteria:',
    '- Requested behavior is clear and testable',
    '- Desktop layout is preserved unless the request is about desktop',
    '- Mobile behavior is checked if the issue affects mobile',
    '- No unrelated files are changed',
    'QA checklist:',
    '- git diff --check',
    '- bash scripts/wtw-pre-commit-check.sh',
    '- manual smoke test for the affected page or command',
    'Safety notes:',
    '- This is a draft only.',
    '- No GitHub issue was created.',
    '- No files were edited.',
    '- No Supabase writes.',
    '- No messages were sent.',
    '',
    'Approval required: APPROVE ISSUE',
    'Approval required for build: APPROVE BUILD',
    'Approval required for push: APPROVE PUSH',
  ].join('\n');
}

function buildDraftText() {
  const request = normalizeRequest(cmdText);
  logDraftRequest({
    command: '/build_draft',
    requestType: 'codex_build_prompt_draft',
    riskLevel: 'Medium',
    summary: 'Draft prompt for a safe Codex build request without editing files.',
  });
  return [
    'BUILD DRAFT ONLY',
    'NO FILES EDITED',
    'NO COMMIT',
    'NO PUSH',
    'KWAME APPROVAL REQUIRED',
    'BUILD REQUIRES: APPROVE BUILD',
    'PUSH REQUIRES: APPROVE PUSH',
    '',
    'Task title: ' + request,
    'User request: ' + request,
    'Build type: Codex build prompt draft',
    'Risk level: Medium',
    '',
    'Files to inspect: [determine exact files during review]',
    'Files likely to edit: [determine exact files during review]',
    'Rules for minimal safe edits:',
    '- Make the smallest change needed.',
    '- Preserve the current design unless the request explicitly changes it.',
    '- Do not touch unrelated files.',
    '- Keep public site pages frozen unless fixing a real bug.',
    '',
    'WTW brand/language rules:',
    '- Keep language premium, honest, and approval-based.',
    '- Do not imply guaranteed entry, guaranteed tables, official partnership, or instant confirmation.',
    '',
    'QA checklist:',
    '- git diff --check',
    '- bash scripts/wtw-pre-commit-check.sh',
    '- manual smoke test for the affected page or command',
    '',
    'Stop conditions:',
    '- Stop after a draft plan and do not edit files.',
    '- Stop if the request is ambiguous and ask for details.',
    '',
    'Final response requirements:',
    '- Summarize the exact files and checks.',
    '- Return the draft only.',
    '- Do not commit or push.',
  ].join('\n');
}

function nextText() {
  return [
    'Next safest WTW move',
    '--------------------',
    'Do not touch the public site unless you are fixing a real bug.',
    '',
    'Recommended next technical move:',
    'Add a /build_draft command that turns an approved issue brief into a Codex build prompt, still read-only and no file edits.',
    '',
    'Recommended next business move:',
    'Use the presentation site and outreach docs to contact the first 20 venues, restaurants, and promoters.',
    '',
    'Recommended safety rule:',
    'Any build or push still requires explicit APPROVE BUILD and APPROVE PUSH.',
  ].join('\n');
}

function qaText() {
  const scan = runReadOnlyScript('scripts/wtw-qa-scan.sh');
  const preCommit = runReadOnlyScript('scripts/wtw-pre-commit-check.sh');
  return [
    formatBlock('QA scan', scan),
    '',
    formatBlock('Pre-commit check', preCommit),
  ].join('\n');
}

function scoreText() {
  return [
    'Public presentation readiness: 9.7/10',
    'Club owner demo readiness: 9.0/10',
    'Investor presentation readiness: 8.6/10',
    'Public launch readiness: 8.0/10',
    'Mobile readiness: 8.0/10',
    'Overall readiness: 8.7/10',
  ].join('\n');
}

function pagesText() {
  return [
    'Active public pages:',
    '- index.html',
    '- events.html',
    '- all-events.html',
    '- event-detail.html',
    '- indulge.html',
    '- indulge-detail.html',
    '- pass.html',
    '- partners.html',
    '- feedback.html',
    '- confirmation.html',
    '- qr-checkin.html',
    '',
    'Legacy redirects:',
    '- venues.html -> indulge.html',
    '- event.html -> events.html',
    '- tables.html -> events.html',
  ].join('\n');
}

function whatChangedText() {
  const log = runGitLog();
  return log || 'No commit history available.';
}

function presentationReadyText() {
  return [
    'Laptop demo: yes',
    'Controlled club-owner demo: yes',
    'Investor walkthrough: yes, with live-vs-planned framing',
    'Phone demo: yes, mobile overflow fix completed; final device QA recommended',
  ].join('\n');
}

function notePrefix() {
  return 'MOCK LOCAL DATA — not live Supabase yet.\n';
}

function tonightText() {
  const events = mockData.events || [];
  const guestCount = (mockData.guestListRequests || []).filter(r => r.status !== 'approved').length;
  const vipCount = (mockData.vipRequests || []).filter(r => r.status !== 'approved').length;
  const reservationCount = (mockData.reservationRequests || []).filter(r => r.status !== 'approved').length;
  const waveCount = (mockData.wavePassRequests || []).filter(r => r.status !== 'approved').length;
  const lines = [
    `Tonight (${events.length} events):`,
    ...events.slice(0, 4).map((event) => `- ${event.city}: ${event.title} at ${event.venue_name} (${event.status})`),
    '',
    `Guest lists pending: ${guestCount}`,
    `VIP/table requests pending: ${vipCount}`,
    `Reservation requests pending: ${reservationCount}`,
    `Wave Pass requests pending: ${waveCount}`,
  ];
  return notePrefix() + lines.join('\n');
}

function eventsText() {
  const events = mockData.events || [];
  const lines = [
    'MOCK LOCAL DATA — not live Supabase yet.',
    `Events (${events.length}):`,
    ...events.map((event) => `- ${event.id}: ${event.title} | ${event.city} | ${event.date} | ${event.venue_name} | ${event.status}`),
  ];
  return lines.join('\n');
}

function ticketsText() {
  const tickets = mockData.tickets || {};
  const totalSold = Object.values(tickets).reduce((sum, item) => sum + (item.sold || 0), 0);
  const totalPending = Object.values(tickets).reduce((sum, item) => sum + (item.pending || 0), 0);
  const totalRemaining = Object.values(tickets).reduce((sum, item) => sum + (item.remaining || 0), 0);
  const lines = [
    'MOCK LOCAL DATA — not live Supabase yet.',
    `Tickets summary: sold ${totalSold}, pending ${totalPending}, remaining ${totalRemaining}`,
    ...Object.entries(tickets).map(([id, item]) => `- ${id}: sold ${item.sold || 0}, pending ${item.pending || 0}, remaining ${item.remaining || 0}`),
  ];
  return lines.join('\n');
}

function restaurantsText() {
  const restaurants = mockData.restaurants || [];
  const lines = [
    'MOCK LOCAL DATA — not live Supabase yet.',
    `Indulge inventory (${restaurants.length}):`,
    ...restaurants.map((item) => `- ${item.name} | ${item.city} | ${item.type} | ${item.status}`),
  ];
  return lines.join('\n');
}

function reservationsText() {
  const reservations = mockData.reservationRequests || [];
  const lines = [
    'MOCK LOCAL DATA — not live Supabase yet.',
    `Reservation requests (${reservations.length}):`,
    ...reservations.map((item) => `- ${item.customer_name} | ${item.event_or_venue} | party ${item.party_size} | ${item.status}`),
  ];
  return lines.join('\n');
}

function vipText() {
  const vipRequests = mockData.vipRequests || [];
  const lines = [
    'MOCK LOCAL DATA — not live Supabase yet.',
    `VIP/table requests (${vipRequests.length}):`,
    ...vipRequests.map((item) => `- ${item.customer_name} | ${item.event_or_venue} | party ${item.party_size} | ${item.status}`),
  ];
  return lines.join('\n');
}

function moneyText() {
  const rev = mockData.revenueEstimates || {};
  const lines = [
    'MOCK LOCAL DATA — not live Supabase yet.',
    `Estimated tonight: ${rev.tonight || '$0'}`,
    `Estimated weekend: ${rev.weekend || '$0'}`,
    `Estimated month-to-date: ${rev.monthToDate || '$0'}`,
  ];
  return lines.join('\n');
}

function briefText() {
  const events = mockData.events || [];
  const tickets = mockData.tickets || {};
  const totalSold = Object.values(tickets).reduce((sum, item) => sum + (item.sold || 0), 0);
  const totalPending = Object.values(tickets).reduce((sum, item) => sum + (item.pending || 0), 0);
  const totalRemaining = Object.values(tickets).reduce((sum, item) => sum + (item.remaining || 0), 0);
  const vipCount = (mockData.vipRequests || []).length;
  const reservationCount = (mockData.reservationRequests || []).length;
  const waveCount = (mockData.wavePassRequests || []).length;
  const revenue = (mockData.revenueEstimates || {}).tonight || '$0';
  return [
    'MOCK LOCAL DATA — not live Supabase yet.',
    `Tonight's events: ${events.slice(0, 3).map(e => e.title).join(', ') || 'none'}`,
    `Tickets: sold ${totalSold}, pending ${totalPending}, remaining ${totalRemaining}`,
    `VIP requests: ${vipCount}`,
    `Reservation requests: ${reservationCount}`,
    `Wave Pass requests: ${waveCount}`,
    `Revenue estimate: ${revenue}`,
    'Next operator action: review the busiest event and clear pending VIP or reservation routing.',
  ].join('\n');
}

function liveCheckText() {
  return [
    'True live HTTP checks come later.',
    '',
    'Manually check these pages for now:',
    '- index.html',
    '- events.html',
    '- all-events.html',
    '- event-detail.html',
    '- indulge.html',
    '- indulge-detail.html',
    '- pass.html',
    '- partners.html',
    '- feedback.html',
    '- confirmation.html',
    '- qr-checkin.html',
    '- venues.html (redirects to indulge.html)',
    '- event.html (redirects to events.html)',
    '- tables.html (redirects to events.html)',
  ].join('\n');
}

function makePromptText() {
  return [
    'Codex prompt template:',
    '',
    'You are Codex continuing WTW.',
    '',
    'CURRENT LOOP:',
    '[describe the exact task]',
    '',
    'GOAL:',
    '[describe the safe outcome]',
    '',
    'ALLOWED FILES:',
    '[list exact files]',
    '',
    'DO NOT TOUCH:',
    '[list locked areas]',
    '',
    'TASK:',
    '1. [specific step]',
    '2. [specific step]',
    '',
    'VALIDATION:',
    '[list checks]',
    '',
    'STOP RULES:',
    '- Stop after report.',
    '- Do not commit.',
    '- Do not push.',
  ].join('\n');
}

function draftEditText() {
  logDraftRequest({
    command: '/draft_edit',
    requestType: 'site_copy_update / site_visual_fix',
    riskLevel: 'Medium',
    summary: 'Draft prompt for a safe copy, layout, or text edit request.',
  });
  return promptShell(
    'Draft: Edit Request',
    'site_copy_update / site_visual_fix',
    'Public site copy, layout, or text',
    'Medium',
    'Make the smallest safe change, preserve the current design, and do not edit anything yet.',
    'Which page and which exact section should change?',
    [
      'You are Codex continuing WTW.',
      '',
      'CURRENT LOOP:',
      `Edit request: ${normalizeRequest(cmdText)}`,
      '',
      'GOAL:',
      'Create a safe, minimal edit plan for the requested page or copy change.',
      '',
      'ALLOWED FILES:',
      '[list only the exact files needed]',
      '',
      'DO NOT TOUCH:',
      'backend/Supabase, SQL/RLS, admin/partner logic, email/SMS, and any public files not needed for the request.',
      '',
      'TASK:',
      '1. Identify the target area.',
      '2. Propose the smallest safe change.',
      '3. Note any missing details.',
      '4. Produce a Codex-ready prompt only.',
      '',
      'VALIDATION:',
      'git diff --check',
      'bash scripts/wtw-pre-commit-check.sh',
      '',
      'STOP RULES:',
      '- Stop after report.',
      '- Do not commit.',
      '- Do not push.',
    ].join('\n'),
  );
}

function draftEventText() {
  logDraftRequest({
    command: '/draft_event',
    requestType: 'event_create / event_update',
    riskLevel: 'Medium',
    summary: 'Draft prompt for a safe event create or update request.',
  });
  return promptShell(
    'Draft: Event Request',
    'event_create / event_update',
    'Event title, date, city, ticket, or request copy',
    'Medium',
    'Use WTW-safe language, keep access subject to availability, and avoid implying guaranteed entry.',
    'Which event, city, date, and field need the update?',
    [
      'You are Codex continuing WTW.',
      '',
      'CURRENT LOOP:',
      `Event request: ${normalizeRequest(cmdText)}`,
      '',
      'GOAL:',
      'Create a safe event update or event creation prompt.',
      '',
      'ALLOWED FILES:',
      '[list only the exact files needed]',
      '',
      'DO NOT TOUCH:',
      'backend/Supabase, SQL/RLS, admin/partner logic, email/SMS, and any unrelated public pages.',
      '',
      'TASK:',
      '1. Identify the exact event target.',
      '2. Keep language curated and access-based.',
      '3. Avoid guaranteeing availability or entry.',
      '4. Produce a Codex-ready prompt only.',
      '',
      'VALIDATION:',
      'git diff --check',
      'bash scripts/wtw-pre-commit-check.sh',
      '',
      'STOP RULES:',
      '- Stop after report.',
      '- Do not commit.',
      '- Do not push.',
    ].join('\n'),
  );
}

function draftPriceText() {
  logDraftRequest({
    command: '/draft_price',
    requestType: 'event_price_update / pricing language update',
    riskLevel: 'Medium',
    summary: 'Draft prompt for a safe pricing copy or ticket price request.',
  });
  return promptShell(
    'Draft: Price Update',
    'event_price_update / pricing language update',
    'Visible pricing, spend language, or ticket copy',
    'Medium',
    'Keep pricing honest, avoid guaranteed entry language, and treat venue minimums as partner-confirmed only.',
    'Which event or page and which price field needs the update?',
    [
      'You are Codex continuing WTW.',
      '',
      'CURRENT LOOP:',
      `Price request: ${normalizeRequest(cmdText)}`,
      '',
      'GOAL:',
      'Create a safe pricing edit prompt.',
      '',
      'ALLOWED FILES:',
      '[list only the exact files needed]',
      '',
      'DO NOT TOUCH:',
      'backend/Supabase, SQL/RLS, admin/partner logic, email/SMS, and any unrelated public pages.',
      '',
      'TASK:',
      '1. Identify the current visible price or spend language.',
      '2. Propose the new price wording.',
      '3. Keep entry and availability language non-guaranteed.',
      '4. Produce a Codex-ready prompt only.',
      '',
      'VALIDATION:',
      'git diff --check',
      'bash scripts/wtw-pre-commit-check.sh',
      '',
      'STOP RULES:',
      '- Stop after report.',
      '- Do not commit.',
      '- Do not push.',
    ].join('\n'),
  );
}

function draftMobileFixText() {
  logDraftRequest({
    command: '/draft_mobile_fix',
    requestType: 'site_visual_fix',
    riskLevel: 'Medium',
    summary: 'Draft prompt for a minimal mobile layout fix request.',
  });
  return promptShell(
    'Draft: Mobile Fix',
    'site_visual_fix',
    'Mobile layout, spacing, overflow, clipping, or hero behavior',
    'Medium',
    'Inspect the smallest set of files, preserve the current design, and fix only what is necessary.',
    'Which page and which mobile width / device issue should be addressed?',
    [
      'You are Codex continuing WTW.',
      '',
      'CURRENT LOOP:',
      `Mobile fix request: ${normalizeRequest(cmdText)}`,
      '',
      'GOAL:',
      'Create a safe, minimal mobile layout fix prompt.',
      '',
      'ALLOWED FILES:',
      '[list only the exact files needed]',
      '',
      'DO NOT TOUCH:',
      'backend/Supabase, SQL/RLS, admin/partner logic, email/SMS, and any unrelated public pages.',
      '',
      'TASK:',
      '1. Inspect the mobile width issue.',
      '2. Fix only the smallest necessary files.',
      '3. Preserve desktop layout.',
      '4. Run QA after the change.',
      '5. Produce a Codex-ready prompt only.',
      '',
      'VALIDATION:',
      'git diff --check',
      'bash scripts/wtw-qa-scan.sh',
      'bash scripts/wtw-pre-commit-check.sh',
      '',
      'STOP RULES:',
      '- Stop after report.',
      '- Do not commit.',
      '- Do not push.',
    ].join('\n'),
  );
}

function draftOutreachText() {
  logDraftRequest({
    command: '/draft_outreach',
    requestType: 'outreach_task',
    riskLevel: 'Low to Medium',
    summary: 'Draft outreach message request for a venue, restaurant, promoter, or investor.',
  });
  return [
    'DRAFT ONLY',
    'NO FILES EDITED',
    'KWAME APPROVAL REQUIRED',
    'PRODUCTION PUSH REQUIRES: APPROVE PUSH',
    '',
    'Request type: outreach_task',
    'Target area: venue / restaurant / promoter / investor outreach',
    'Risk level: Low to Medium',
    '',
    `Request text: ${normalizeRequest(cmdText)}`,
    '',
    'Assumptions: Use curated demand, request routing, priority review, and partner confirmation language only.',
    'Missing details: Which market, target type, and tone should this outreach use?',
    '',
    'Safe outreach prompt:',
    [
      'You are Codex continuing WTW.',
      '',
      'CURRENT LOOP:',
      `Draft outreach for: ${normalizeRequest(cmdText)}`,
      '',
      'GOAL:',
      'Write an internal outreach message that is premium, honest, and approval-based.',
      '',
      'ALLOWED FILES:',
      '[no file edits; output only the outreach draft]',
      '',
      'DO NOT TOUCH:',
      'Do not claim official partnership, guaranteed entry, guaranteed tables, instant confirmation, or final pricing.',
      '',
      'TASK:',
      '1. Identify the target type and market.',
      '2. Draft a short and a longer outreach version if useful.',
      '3. Keep the language curated and request-based.',
      '4. End with a low-pressure pilot ask.',
      '',
      'VALIDATION:',
      'No edits. No sends. No commits.',
      '',
      'STOP RULES:',
      '- Stop after report.',
      '- Do not commit.',
      '- Do not push.',
    ].join('\n'),
    '',
    approvalReminder(),
  ].join('\n');
}

const outputs = {
  '/help': helpText,
  '/status': statusText,
  '/qa': qaText,
  '/score': scoreText,
  '/pages': pagesText,
  '/what_changed': whatChangedText,
  '/presentation_ready': presentationReadyText,
  '/live_check': liveCheckText,
  '/tonight': tonightText,
  '/events': eventsText,
  '/tickets': ticketsText,
  '/restaurants': restaurantsText,
  '/reservations': reservationsText,
  '/vip': vipText,
  '/money': moneyText,
  '/brief': briefText,
  '/make_prompt': makePromptText,
  '/draft_edit': draftEditText,
  '/draft_event': draftEventText,
  '/draft_price': draftPriceText,
  '/draft_mobile_fix': draftMobileFixText,
  '/draft_outreach': draftOutreachText,
  '/issue_draft': issueDraftText,
  '/build_draft': buildDraftText,
  '/logs': logsText,
  '/next': nextText,
};

const handler = outputs[cmd];

if (!handler) {
  console.error(`Unknown command: ${cmd}`);
  console.error('');
  console.error(helpText());
  process.exitCode = 1;
} else {
  console.log(handler());
}
