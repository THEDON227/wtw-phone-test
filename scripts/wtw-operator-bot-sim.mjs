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
const supabaseConfig = {
  url: (process.env.WTW_SUPABASE_URL || '').trim(),
  anonKey: (process.env.WTW_SUPABASE_ANON_KEY || '').trim(),
};

function runGitStatus() {
  return runCapture('git', ['status', '--short']);
}

function runGitLog() {
  return runCapture('git', ['log', '--oneline', '-5']);
}

function runReadOnlyScript(scriptPath) {
  return runCapture('bash', [scriptPath]);
}

function hasSupabaseConfig() {
  return !!(supabaseConfig.url && supabaseConfig.anonKey);
}

function supabaseHeaders() {
  return {
    apikey: supabaseConfig.anonKey,
    Authorization: `Bearer ${supabaseConfig.anonKey}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Prefer: 'count=exact',
  };
}

function classifySupabaseFailure(status) {
  switch (Number(status) || 0) {
    case 0:
      return 'network/error';
    case 400:
      return 'bad request/column mismatch likely';
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden/RLS likely';
    case 404:
      return 'table not found';
    default:
      return 'unknown';
  }
}

function supabaseTableUrl(tableName, params) {
  const base = supabaseConfig.url.replace(/\/+$/, '');
  return `${base}/rest/v1/${tableName}${params ? `?${params.toString()}` : ''}`;
}

function parseSupabaseCount(contentRange, fallbackCount = 0) {
  const raw = String(contentRange || '').trim();
  if (!raw) return fallbackCount;
  const slashIndex = raw.lastIndexOf('/');
  if (slashIndex < 0) return fallbackCount;
  const total = raw.slice(slashIndex + 1).trim();
  if (!total || total === '*') return fallbackCount;
  const parsed = Number.parseInt(total, 10);
  return Number.isFinite(parsed) ? parsed : fallbackCount;
}

async function supabaseSelect(tableName, { select = '*', filters = [], order = null, limit = null } = {}) {
  if (!hasSupabaseConfig()) {
    return { ok: false, configured: false, status: null, reason: 'missing env', error: 'Supabase is not configured for this worker yet.' };
  }

  const params = new URLSearchParams();
  params.set('select', select);
  for (const filter of filters) {
    if (!filter || !filter.column || !filter.operator) continue;
    params.append(filter.column, `${filter.operator}.${filter.value ?? ''}`);
  }
  if (order && order.column) {
    params.set('order', `${order.column}.${order.direction === 'desc' ? 'desc' : 'asc'}`);
  }
  if (typeof limit === 'number') {
    params.set('limit', String(limit));
  }

  try {
    const response = await fetch(supabaseTableUrl(tableName, params), {
      method: 'GET',
      headers: supabaseHeaders(),
    });

    if (!response.ok) {
      return {
        ok: false,
        configured: true,
        status: response.status,
        reason: classifySupabaseFailure(response.status),
        error: `Supabase query failed for ${tableName}.`,
      };
    }

    const text = await response.text();
    let rows = [];
    if (text) {
      try {
        rows = JSON.parse(text);
      } catch {
        rows = [];
      }
    }

    return {
      ok: true,
      configured: true,
      status: response.status,
      reason: 'ok',
      count: parseSupabaseCount(response.headers.get('content-range'), Array.isArray(rows) ? rows.length : 0),
      rows: Array.isArray(rows) ? rows : [],
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      status: 0,
      reason: classifySupabaseFailure(0),
      error: 'Supabase query failed for this table.',
    };
  }
}

function formatShortTime(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'unknown';
  if (raw.length >= 16 && raw.includes('T')) {
    return raw.slice(0, 16).replace('T', ' ');
  }
  return raw;
}

const EVENT_DATE_FIELD = 'event_date';
const CITY_FILTERABLE_REQUEST_TABLES = new Set([
  'reservation_requests',
  'guest_list_requests',
  'wave_pass_requests',
  'partner_applications',
]);

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
    '/tonight [city] - show tonight\'s events, venues, and requests',
    '/events - show mock local event inventory',
    '/tickets - show mock local ticket summary',
    '/restaurants - show mock local Indulge inventory',
    '/reservations - show mock local reservation requests',
    '/vip - show mock local VIP and table requests',
    '/money - show mock local revenue estimates',
    '/brief - show a mock local owner-style daily brief',
    '/data_status - show whether Supabase is configured and queue counts',
    '/requests_today - show today\'s reservation, ticket, and guest list requests',
    '/wave_pass_requests - show latest Wave Pass requests from Supabase',
    '/partner_requests - show latest partner applications from Supabase',
    '/events_status - show event inventory from Supabase',
    '/events_this_week - show events happening this week from Supabase',
    '/venues_status - show venue inventory from Supabase',
    '/cities_status - show which WTW cities have Supabase data',
    '/reservations_today - show today\'s reservation requests',
    '/guest_list_today - show today\'s guest list requests',
    '/tickets_today - show today\'s ticket requests',
    '/latest_requests - show the latest requests across all tables',
    '/operator_brief - show the current operator brief',
    '/weekend [city] - show weekend events and venues',
    '/city_brief [city] - show a city-specific data brief',
    '/ask [question] - route simple natural language questions',
    '/make_prompt - return a safe Codex prompt template',
    '/draft_edit - generate a safe Codex prompt for copy/layout/text edits',
    '/draft_event - generate a safe Codex prompt for event updates',
    '/draft_price - generate a safe Codex prompt for pricing updates',
    '/draft_mobile_fix - generate a safe Codex prompt for mobile fixes',
    '/draft_outreach - generate a safe outreach prompt and message draft',
    '/issue_draft - generates a GitHub issue-style brief only. Does not create the issue.',
    '/build_draft - generates a Codex build prompt draft only. Does not edit files, commit, or push.',
    '/qa_draft - generates a structured QA checklist and commit/push readiness review only. Does not edit files, commit, or push.',
    '/push_draft - generates an exact commit+push prompt draft only. Does not commit or push.',
    '/rollback_draft - generates a rollback prompt draft only. Does not rollback, commit, or push.',
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
    'Bot status: read-only WTW command center is live on Railway; commands remain safe/read-only except local draft logging',
    '',
    'Current bot abilities:',
    '- /help',
    '- /draft_edit',
    '- /draft_event',
    '- /draft_price',
    '- /draft_mobile_fix',
    '- /draft_outreach',
    '- /data_status',
    '- /requests_today',
    '- /wave_pass_requests',
    '- /partner_requests',
    '- /events_status',
    '- /events_this_week',
    '- /venues_status',
    '- /cities_status',
    '- /reservations_today',
    '- /guest_list_today',
    '- /tickets_today',
    '- /latest_requests',
    '- /operator_brief',
    '- /tonight [city]',
    '- /weekend [city]',
    '- /city_brief [city]',
    '- /ask [question]',
    '- /issue_draft',
    '- /build_draft',
    '- /qa_draft',
    '- /push_draft',
    '- /rollback_draft',
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
    'Next recommended move:',
    'Telegram cloud worker is live. Keep public site frozen unless fixing a real bug. Switch back to outreach/business execution, then add Supabase logging later only when needed.',
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

function qaDraftText() {
  const request = normalizeRequest(cmdText);
  return [
    'QA DRAFT ONLY',
    'NO FILES EDITED',
    'NO COMMIT',
    'NO PUSH',
    'KWAME APPROVAL REQUIRED',
    'COMMIT/PUSH REQUIRES APPROVE PUSH',
    '',
    'QA title: ' + request,
    'Build/result being reviewed: ' + request,
    'Risk level: Medium',
    '',
    'Files to verify: [determine exact files during review]',
    'Visual checks:',
    '- Desktop layout',
    '- Mobile layout',
    '- Hero and card spacing',
    '- No clipped or overflowing content',
    'Mobile checks:',
    '- 390px width smoke test',
    '- No horizontal scrolling',
    '- Buttons and forms stay visible',
    'WTW language checks:',
    '- No guaranteed entry language',
    '- No guaranteed table language',
    '- No verified partner language',
    '- No official partner language unless signed',
    'Safety checks:',
    '- No public site edits',
    '- No Supabase writes',
    '- No messages sent',
    '- No unexpected route changes',
    'Git checks:',
    '- git status --short',
    '- git diff --check',
    '- bash scripts/wtw-pre-commit-check.sh',
    'Required commands:',
    '- manual smoke test for the affected page',
    '- manual review of the generated diff',
    'Stop conditions:',
    '- Stop if QA exposes a real bug or unrelated change',
    '- Stop if the build is not clearly safe',
    '',
    'Commit readiness:',
    '- Only after QA passes',
    'Push readiness:',
    '- Only after APPROVE PUSH',
    '',
    'Final approval reminder:',
    '- QA draft only.',
    '- No files edited.',
    '- No commit.',
    '- No push.',
  ].join('\n');
}

function pushDraftText() {
  const request = normalizeRequest(cmdText);
  logDraftRequest({
    command: '/push_draft',
    requestType: 'commit_push_prompt',
    riskLevel: 'Medium',
    summary: 'Draft prompt for a safe commit and push workflow after QA passes.',
  });
  return [
    'PUSH DRAFT ONLY',
    'NO FILES EDITED',
    'NO COMMIT',
    'NO PUSH',
    'KWAME APPROVAL REQUIRED',
    'PUSH REQUIRES: APPROVE PUSH',
    '',
    'Approved files: [list exact file paths only]',
    'Commit message: [write the exact commit message]',
    'Pre-push checks:',
    '- git diff --check',
    '- bash scripts/wtw-pre-commit-check.sh',
    '- manual review of the approved diff',
    '',
    'Exact staging command using specific file paths only:',
    '- git add [exact file paths only]',
    '',
    'Commit command:',
    '- git commit -m "[exact commit message]"',
    '',
    'Clean status check:',
    '- git status --short',
    '',
    'Branch check:',
    '- git branch --show-current',
    '',
    'Push command:',
    '- git push origin main',
    '',
    'Final status check:',
    '- git status --short',
    '',
    'Stop conditions:',
    '- Stop if unexpected files appear.',
    '- Stop if the branch is not main.',
    '- Stop if working tree is not clean after commit.',
    '- Do not stage _dev/operator-bot-draft-log.jsonl.',
    '',
    'Request text: ' + request,
    'Safety notes:',
    '- This is a draft only.',
    '- No commit was created.',
    '- No push was performed.',
    '- No files were edited.',
    '- No Supabase writes.',
    '- No messages were sent.',
  ].join('\n');
}

function rollbackDraftText() {
  const request = normalizeRequest(cmdText);
  return [
    'ROLLBACK DRAFT ONLY',
    'NO FILES EDITED',
    'NO COMMIT',
    'NO PUSH',
    'KWAME APPROVAL REQUIRED',
    'ROLLBACK REQUIRES: APPROVE ROLLBACK',
    'PUSH REQUIRES: APPROVE PUSH',
    '',
    'Rollback title: ' + request,
    'Reason for rollback: ' + request,
    'Risk level: Medium',
    '',
    'Commit/file scope to inspect: [identify the exact commit and files first]',
    'Safe rollback options:',
    '- revert the specific commit',
    '- restore the smallest affected file set',
    '- pause and inspect if the change touched multiple pages',
    'Recommended rollback approach:',
    '- choose the smallest safe revert path after reviewing the diff',
    '',
    'Pre-rollback checks:',
    '- git status --short',
    '- git log --oneline -5',
    '- git diff --check',
    '- manual review of the exact change to revert',
    'Exact git safety checks:',
    '- confirm branch is main before any push',
    '- confirm working tree is clean after rollback',
    '- stop if unexpected files appear',
    '- do not stage _dev/operator-bot-draft-log.jsonl',
    'QA checklist after rollback:',
    '- rerun local smoke test for the affected page',
    '- verify mobile and desktop behavior',
    '- confirm WTW language stays safe and honest',
    '- confirm redirects still work',
    'Stop conditions:',
    '- stop if the rollback target is unclear',
    '- stop if the rollback changes unrelated files',
    '- stop if APPROVE ROLLBACK is not explicit',
    '',
    'Approval requirement: APPROVE ROLLBACK',
    'Push reminder: push only from main after clean status and APPROVE PUSH',
  ].join('\n');
}

function nextText() {
  return [
    'Next safest WTW move',
    '--------------------',
    'Do not touch the public site unless you are fixing a real bug.',
    '',
    'Recommended next technical move:',
    'Stop expanding simulator commands for now. Create a final WTW Operator Bot command checkpoint doc, then switch back to outreach/business execution.',
    '',
    'Recommended next business move:',
    'Use the presentation site, outreach docs, and first 20 target list to start contacting venues, restaurants, lounges, promoters, and potential partners.',
    '',
    'Recommended safety rule:',
    'Public site stays frozen unless fixing a real bug. Build requires APPROVE BUILD. Push requires APPROVE PUSH. Rollback requires APPROVE ROLLBACK.',
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

function readOnlySupabaseUnavailableText() {
  return 'Supabase is not configured for this worker yet.';
}

function formatSupabaseTableLine(tableName, result) {
  if (!result.ok) {
    const status = result.status ? ` (${result.status}, ${result.reason || 'unknown'})` : ` (${result.reason || 'unknown'})`;
    return `- ${tableName}: unavailable${status}`;
  }
  const status = result.status ? ` (${result.status})` : '';
  return `- ${tableName}: ok${status} (${result.count ?? 0})`;
}

function listFieldValues(rows, fieldName) {
  return (rows || [])
    .map((row) => row?.[fieldName])
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function formatCountByValue(rows, fieldName) {
  const counts = new Map();
  for (const value of listFieldValues(rows, fieldName)) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, count]) => `${label}:${count}`)
    .join(', ');
}

function formatEventSummary(row) {
  const when = formatShortTime(row.event_date || row.start_date || row.date || row.created_at);
  return `- ${when} | ${row.market || 'unknown market'} | ${row.title || 'unknown title'} | ${row.venue_name || 'unknown venue'} | ${row.status || 'unknown'}`;
}

function formatVenueSummary(row) {
  return `- ${formatShortTime(row.created_at)} | ${row.market || 'unknown market'} | ${row.name || 'unknown venue'} | ${row.type || 'unknown type'} | ${row.status || 'unknown'}`;
}

const KNOWN_CITY_ORDER = ['NYC', 'NJ', 'Miami', 'LA', 'Dallas', 'Philadelphia', 'Atlanta'];
const CITY_ALIASES = [
  ['new york city', 'NYC'],
  ['new york', 'NYC'],
  ['newyork', 'NYC'],
  ['nyc', 'NYC'],
  ['new jersey', 'NJ'],
  ['newjersey', 'NJ'],
  ['nj', 'NJ'],
  ['miami', 'Miami'],
  ['mia', 'Miami'],
  ['los angeles', 'LA'],
  ['losangeles', 'LA'],
  ['la', 'LA'],
  ['dallas', 'Dallas'],
  ['atlanta', 'Atlanta'],
  ['atl', 'Atlanta'],
  ['philadelphia', 'Philadelphia'],
  ['philly', 'Philadelphia'],
];

function canonicalCity(raw) {
  const normalized = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');
  const compact = normalized.replace(/\s+/g, '');
  for (const [alias, canonical] of CITY_ALIASES) {
    if (normalized === alias || compact === alias.replace(/\s+/g, '')) {
      return canonical;
    }
  }
  return '';
}

function detectCityFromText(text) {
  const raw = String(text || '').toLowerCase();
  for (const [alias, canonical] of CITY_ALIASES) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
    if (re.test(raw)) {
      return canonical;
    }
  }
  return '';
}

function rowCity(row) {
  return String(row?.market ?? row?.city ?? '').trim();
}

function rowCityCanonical(row) {
  return canonicalCity(rowCity(row));
}

function rowsForCity(rows, city) {
  const target = canonicalCity(city);
  if (!target) return rows || [];
  return (rows || []).filter((row) => rowCityCanonical(row) === target);
}

function countByCity(rows) {
  const counts = new Map();
  for (const row of rows || []) {
    const city = rowCityCanonical(row);
    if (!city) continue;
    counts.set(city, (counts.get(city) || 0) + 1);
  }
  return KNOWN_CITY_ORDER.filter((city) => counts.has(city))
    .map((city) => `${city}:${counts.get(city)}`)
    .join(', ');
}

function knownCitiesWithNoData(countsMap) {
  return KNOWN_CITY_ORDER.filter((city) => !(countsMap.get(city) || 0));
}

function latestRowsByCreatedAt(rows, limit = 5) {
  return [...(rows || [])]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, limit);
}

function formatRequestRowSummary(tableName, row) {
  const createdAt = formatShortTime(row.created_at);
  const city = rowCity(row) || 'unknown city';
  if (tableName === 'reservation_requests') {
    return `- ${createdAt} | reservation | ${row.user_name || 'unknown'} | ${city} | ${row.venue_name || 'unknown venue'}`;
  }
  if (tableName === 'ticket_requests') {
    return `- ${createdAt} | ticket | ${row.user_name || 'unknown'} | ${row.event_title || 'unknown event'} | ${row.ticket_type || 'unknown type'}`;
  }
  if (tableName === 'guest_list_requests') {
    return `- ${createdAt} | guest list | ${row.user_name || 'unknown'} | ${city} | ${row.event_title || 'unknown event'}`;
  }
  if (tableName === 'wave_pass_requests') {
    return `- ${createdAt} | wave pass | ${row.full_name || 'unknown'} | ${city} | ${row.status || 'unknown'}`;
  }
  if (tableName === 'partner_applications') {
    return `- ${createdAt} | partner | ${row.contact_name || 'unknown'} | ${city} | ${row.business_name || 'unknown business'}`;
  }
  return `- ${createdAt} | ${tableName} | ${row.user_name || row.full_name || row.contact_name || 'unknown'}`;
}

async function supabaseRows(tableName, select, options = {}) {
  const result = await supabaseSelect(tableName, {
    select,
    order: options.order || { column: 'created_at', direction: 'desc' },
    limit: options.limit ?? 1000,
    filters: options.filters || [],
  });
  return result;
}

function rangeDateString(value) {
  return new Date(value).toISOString().slice(0, 10);
}

async function eventsStatusText() {
  if (!hasSupabaseConfig()) {
    return readOnlySupabaseUnavailableText();
  }

  const result = await supabaseSelect('events', {
    select: 'id,title,venue_name,market,category,event_date,start_time,end_time,status,created_at',
    order: { column: 'created_at', direction: 'desc' },
    limit: 20,
  });

  if (!result.ok) {
    return [
      'Supabase query failed for events.',
      formatSupabaseTableLine('events', result),
      'Please verify Railway env vars and RLS/select policies.',
    ].join('\n');
  }

  if (!result.rows.length) {
    return 'No visible Supabase events found yet. Public site may still be using static event data.';
  }

  const lines = [
    `Events total: ${result.count ?? result.rows.length}`,
    formatCityCounts(result.rows) ? `By city: ${formatCityCounts(result.rows)}` : null,
    listFieldValues(result.rows, 'status').length ? `By status: ${formatCountByValue(result.rows, 'status')}` : null,
    '',
    'Latest few events:',
    ...result.rows.slice(0, 5).map((row) => formatEventSummary(row)),
  ].filter(Boolean);

  return lines.join('\n');
}

async function eventsThisWeekText() {
  if (!hasSupabaseConfig()) {
    return readOnlySupabaseUnavailableText();
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const result = await supabaseSelect('events', {
    select: 'id,title,venue_name,market,category,event_date,start_time,end_time,status,created_at',
    filters: [
      { column: EVENT_DATE_FIELD, operator: 'gte', value: rangeDateString(start) },
      { column: EVENT_DATE_FIELD, operator: 'lte', value: rangeDateString(end) },
    ],
    order: { column: EVENT_DATE_FIELD, direction: 'asc' },
    limit: 10,
  });

  if (!result.ok) {
    return [
      'Supabase query failed for events.',
      formatSupabaseTableLine('events', result),
      'Please verify Railway env vars and RLS/select policies.',
    ].join('\n');
  }

  if (!result.rows.length) {
    return 'No Supabase events found this week yet. Public site may still be using static event data.';
  }

  return [
    `Events this week: ${result.count ?? result.rows.length}`,
    '',
    ...result.rows.slice(0, 10).map((row) => formatEventSummary(row)),
  ].join('\n');
}

async function venuesStatusText() {
  if (!hasSupabaseConfig()) {
    return readOnlySupabaseUnavailableText();
  }

  const result = await supabaseSelect('venues', {
    select: 'id,name,market,type,neighborhood,status,created_at',
    order: { column: 'created_at', direction: 'desc' },
    limit: 20,
  });

  if (!result.ok) {
    return [
      'Supabase query failed for venues.',
      formatSupabaseTableLine('venues', result),
      'Please verify Railway env vars and RLS/select policies.',
    ].join('\n');
  }

  if (!result.rows.length) {
    return 'No visible Supabase venues found yet. Public site may still be using static venue data.';
  }

  const lines = [
    `Venues total: ${result.count ?? result.rows.length}`,
    formatCityCounts(result.rows) ? `By city: ${formatCityCounts(result.rows)}` : null,
    listFieldValues(result.rows, 'type').length ? `By type: ${formatCountByValue(result.rows, 'type')}` : null,
    '',
    'Latest few venues:',
    ...result.rows.slice(0, 5).map((row) => formatVenueSummary(row)),
  ].filter(Boolean);

  return lines.join('\n');
}

function formatCityCounts(rows) {
  const counts = new Map();
  for (const row of rows || []) {
    const city = rowCityCanonical(row);
    if (!city) continue;
    counts.set(city, (counts.get(city) || 0) + 1);
  }
  return KNOWN_CITY_ORDER.filter((city) => counts.has(city))
    .map((city) => `${city}:${counts.get(city)}`)
    .join(', ');
}

async function citiesStatusText() {
  if (!hasSupabaseConfig()) {
    return readOnlySupabaseUnavailableText();
  }

  const [events, venues, reservations, guestLists, wavePassRequests, partnerApplications] = await Promise.all([
    supabaseRows('events', 'id,market', { limit: 1000 }),
    supabaseRows('venues', 'id,market', { limit: 1000 }),
    supabaseRows('reservation_requests', 'id,market', { limit: 1000 }),
    supabaseRows('guest_list_requests', 'id,market', { limit: 1000 }),
    supabaseRows('wave_pass_requests', 'id,market', { limit: 1000 }),
    supabaseRows('partner_applications', 'id,market', { limit: 1000 }),
  ]);

  const results = [events, venues, reservations, guestLists, wavePassRequests, partnerApplications];
  const failure = results.find((result) => !result.ok);
  if (failure) {
    return [
      'Supabase query failed for one or more city tables.',
      formatSupabaseTableLine('events', events),
      formatSupabaseTableLine('venues', venues),
      formatSupabaseTableLine('reservation_requests', reservations),
      formatSupabaseTableLine('guest_list_requests', guestLists),
      formatSupabaseTableLine('wave_pass_requests', wavePassRequests),
      formatSupabaseTableLine('partner_applications', partnerApplications),
      'Please verify Railway env vars and RLS/select policies.',
    ].join('\n');
  }

  const eventRows = events.rows || [];
  const venueRows = venues.rows || [];
  const requestRows = [
    ...(reservations.rows || []),
    ...(guestLists.rows || []),
    ...(wavePassRequests.rows || []),
    ...(partnerApplications.rows || []),
  ];

  const foundCounts = new Map();
  for (const row of [...eventRows, ...venueRows, ...requestRows]) {
    const city = rowCityCanonical(row);
    if (!city) continue;
    foundCounts.set(city, (foundCounts.get(city) || 0) + 1);
  }

  return [
    'Cities status:',
    `All cities found: ${Array.from(foundCounts.keys()).join(', ') || 'none'}`,
    `Event count by city: ${formatCityCounts(eventRows) || 'none'}`,
    `Venue count by city: ${formatCityCounts(venueRows) || 'none'}`,
    `Request count by city: ${formatCityCounts(requestRows) || 'none'}`,
    `No Supabase data yet: ${KNOWN_CITY_ORDER.filter((city) => !foundCounts.has(city)).join(', ') || 'none'}`,
    'Note: ticket_requests has no city field in schema, so it is not included in city counts.',
  ].join('\n');
}

async function requestsTodayByTableText(tableName, select, rowFormatter, cityInput = '') {
  if (!hasSupabaseConfig()) {
    return readOnlySupabaseUnavailableText();
  }

  const today = new Date();
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const city = canonicalCity(cityInput);
  const filters = [
    { column: 'created_at', operator: 'gte', value: start.toISOString() },
    { column: 'created_at', operator: 'lt', value: end.toISOString() },
  ];

  const result = await supabaseRows(tableName, select, {
    filters,
    order: { column: 'created_at', direction: 'desc' },
    limit: 10,
  });

  if (!result.ok) {
    return [
      `Supabase query failed for ${tableName}.`,
      formatSupabaseTableLine(tableName, result),
      'Please verify Railway env vars and RLS/select policies.',
    ].join('\n');
  }

  if (!result.rows.length) {
    if (city && !CITY_FILTERABLE_REQUEST_TABLES.has(tableName)) {
      return `No visible ${tableName} rows found today. City-specific filtering is unavailable because ${tableName} has no market field.`;
    }
    return `No visible ${tableName} rows found today.`;
  }

  const visibleRows = city && CITY_FILTERABLE_REQUEST_TABLES.has(tableName)
    ? rowsForCity(result.rows, city)
    : (result.rows || []);
  const count = visibleRows.length;
  const header = city && CITY_FILTERABLE_REQUEST_TABLES.has(tableName)
    ? `${tableName} in ${city}: ${count} today`
    : `${tableName}: ${result.count ?? result.rows.length} today`;

  const lines = [
    header,
    '',
    ...latestRowsByCreatedAt(visibleRows, 5).map((row) => rowFormatter(row)),
  ];

  if (city && !CITY_FILTERABLE_REQUEST_TABLES.has(tableName)) {
    lines.push('');
    lines.push(`Note: city-specific filtering is unavailable for ${tableName} because the table has no market field.`);
  } else if (city && CITY_FILTERABLE_REQUEST_TABLES.has(tableName) && count === 0) {
    lines.push('');
    lines.push(`Note: no visible ${tableName} rows matched ${city} today.`);
  }

  return lines.join('\n');
}

async function reservationsTodayText(cityInput = '') {
  return requestsTodayByTableText(
    'reservation_requests',
    'id,user_name,market,venue_name,requested_date,requested_time,party_size,status,created_at',
    (row) => formatRequestRowSummary('reservation_requests', row),
    cityInput,
  );
}

async function guestListTodayText(cityInput = '') {
  return requestsTodayByTableText(
    'guest_list_requests',
    'id,user_name,event_title,market,party_size,arrival_time,status,created_at',
    (row) => formatRequestRowSummary('guest_list_requests', row),
    cityInput,
  );
}

async function ticketsTodayText(cityInput = '') {
  return requestsTodayByTableText(
    'ticket_requests',
    'id,user_name,event_title,ticket_type,quantity,status,created_at',
    (row) => formatRequestRowSummary('ticket_requests', row),
    cityInput,
  );
}

async function latestRequestsText() {
  if (!hasSupabaseConfig()) {
    return readOnlySupabaseUnavailableText();
  }

  const [reservations, tickets, guestLists, wavePassRequests, partnerApplications] = await Promise.all([
    supabaseRows('reservation_requests', 'id,user_name,market,venue_name,status,created_at', { limit: 5 }),
    supabaseRows('ticket_requests', 'id,user_name,event_title,ticket_type,status,created_at', { limit: 5 }),
    supabaseRows('guest_list_requests', 'id,user_name,event_title,market,party_size,status,created_at', { limit: 5 }),
    supabaseRows('wave_pass_requests', 'id,full_name,market,status,created_at', { limit: 5 }),
    supabaseRows('partner_applications', 'id,business_name,market,contact_name,status,created_at', { limit: 5 }),
  ]);

  const results = [reservations, tickets, guestLists, wavePassRequests, partnerApplications];
  const failure = results.find((result) => !result.ok);
  if (failure) {
    return [
      'Supabase query failed for one or more request tables.',
      formatSupabaseTableLine('reservation_requests', reservations),
      formatSupabaseTableLine('ticket_requests', tickets),
      formatSupabaseTableLine('guest_list_requests', guestLists),
      formatSupabaseTableLine('wave_pass_requests', wavePassRequests),
      formatSupabaseTableLine('partner_applications', partnerApplications),
      'Please verify Railway env vars and RLS/select policies.',
    ].join('\n');
  }

  const combined = [
    ...(reservations.rows || []).map((row) => ({ table: 'reservation_requests', row })),
    ...(tickets.rows || []).map((row) => ({ table: 'ticket_requests', row })),
    ...(guestLists.rows || []).map((row) => ({ table: 'guest_list_requests', row })),
    ...(wavePassRequests.rows || []).map((row) => ({ table: 'wave_pass_requests', row })),
    ...(partnerApplications.rows || []).map((row) => ({ table: 'partner_applications', row })),
  ]
    .sort((a, b) => new Date(b.row.created_at || 0).getTime() - new Date(a.row.created_at || 0).getTime())
    .slice(0, 8);

  if (!combined.length) {
    return 'No recent requests found.';
  }

  return [
    'Latest requests:',
    '',
    ...combined.map(({ table, row }) => formatRequestRowSummary(table, row)),
  ].join('\n');
}

async function operatorBriefText() {
  if (!hasSupabaseConfig()) {
    return readOnlySupabaseUnavailableText();
  }

  const [reservations, tickets, guestLists, wavePassRequests, partnerApplications] = await Promise.all([
    supabaseRows('reservation_requests', 'id,created_at', { limit: 1000 }),
    supabaseRows('ticket_requests', 'id,created_at', { limit: 1000 }),
    supabaseRows('guest_list_requests', 'id,created_at', { limit: 1000 }),
    supabaseRows('wave_pass_requests', 'id,status,created_at', { limit: 1000 }),
    supabaseRows('partner_applications', 'id,status,created_at', { limit: 1000 }),
  ]);

  if (!reservations.ok || !tickets.ok || !guestLists.ok || !wavePassRequests.ok || !partnerApplications.ok) {
    return [
      'Supabase query failed for operator brief.',
      formatSupabaseTableLine('reservation_requests', reservations),
      formatSupabaseTableLine('ticket_requests', tickets),
      formatSupabaseTableLine('guest_list_requests', guestLists),
      formatSupabaseTableLine('wave_pass_requests', wavePassRequests),
      formatSupabaseTableLine('partner_applications', partnerApplications),
      'Please verify Railway env vars and RLS/select policies.',
    ].join('\n');
  }

  const summaryCounts = {
    reservations: (reservations.rows || []).length,
    tickets: (tickets.rows || []).length,
    guestLists: (guestLists.rows || []).length,
  };
  const totalToday = summaryCounts.reservations + summaryCounts.tickets + summaryCounts.guestLists;

  return [
    'Operator brief:',
    '',
    'Data status: Supabase configured; read-only data checks active.',
    `Total new requests today: ${totalToday}`,
    `Reservations today: ${summaryCounts.reservations}`,
    `Tickets today: ${summaryCounts.tickets}`,
    `Guest list today: ${summaryCounts.guestLists}`,
    `Wave Pass requests: ${wavePassRequests.count ?? 0}`,
    `Partner applications: ${partnerApplications.count ?? 0}`,
    'Suggested next move: review the busiest city and clear the newest request first.',
  ].join('\n');
}

function cityBriefFallback(city) {
  return `Supabase is not configured for this worker yet. City brief requested for ${city || 'all cities'}.`;
}

async function cityBriefText(cityInput) {
  const city = canonicalCity(cityInput);
  if (!city) {
    return 'City brief needs a city name. Try /city_brief NYC.';
  }
  if (!hasSupabaseConfig()) {
    return cityBriefFallback(city);
  }

  const [events, venues, reservations, guestLists, wavePassRequests, partnerApplications] = await Promise.all([
    supabaseRows('events', 'id,title,venue_name,market,event_date,status,created_at', { limit: 1000 }),
    supabaseRows('venues', 'id,name,market,type,status,created_at', { limit: 1000 }),
    supabaseRows('reservation_requests', 'id,user_name,market,venue_name,status,created_at', { limit: 1000 }),
    supabaseRows('guest_list_requests', 'id,user_name,event_title,market,status,created_at', { limit: 1000 }),
    supabaseRows('wave_pass_requests', 'id,full_name,market,status,created_at', { limit: 1000 }),
    supabaseRows('partner_applications', 'id,business_name,market,contact_name,status,created_at', { limit: 1000 }),
  ]);

  const results = [events, venues, reservations, guestLists, wavePassRequests, partnerApplications];
  const failure = results.find((result) => !result.ok);
  if (failure) {
    return [
      `Supabase query failed for city brief (${city}).`,
      formatSupabaseTableLine('events', events),
      formatSupabaseTableLine('venues', venues),
      formatSupabaseTableLine('reservation_requests', reservations),
      formatSupabaseTableLine('guest_list_requests', guestLists),
      formatSupabaseTableLine('wave_pass_requests', wavePassRequests),
      formatSupabaseTableLine('partner_applications', partnerApplications),
      'Please verify Railway env vars and RLS/select policies.',
    ].join('\n');
  }

  const cityEvents = rowsForCity(events.rows, city);
  const cityVenues = rowsForCity(venues.rows, city);
  const cityRequests = [
    ...rowsForCity(reservations.rows, city).map((row) => ({ table: 'reservation_requests', row })),
    ...rowsForCity(guestLists.rows, city).map((row) => ({ table: 'guest_list_requests', row })),
    ...rowsForCity(wavePassRequests.rows, city).map((row) => ({ table: 'wave_pass_requests', row })),
    ...rowsForCity(partnerApplications.rows, city).map((row) => ({ table: 'partner_applications', row })),
  ].sort((a, b) => new Date(b.row.created_at || 0).getTime() - new Date(a.row.created_at || 0).getTime());

  return [
    `City brief: ${city}`,
    `Event count: ${cityEvents.length}`,
    `Venue count: ${cityVenues.length}`,
    `Request count: ${cityRequests.length}`,
    '',
    'Latest few relevant items:',
    ...(cityEvents.slice(0, 2).map((row) => formatEventSummary(row))),
    ...(cityVenues.slice(0, 2).map((row) => formatVenueSummary(row))),
    ...(cityRequests.slice(0, 3).map(({ table, row }) => formatRequestRowSummary(table, row))),
    '',
    `Next suggested operator action: ${cityRequests.length ? 'review the newest request in this city first.' : 'check events and venues in this city for availability gaps.'}`,
  ].join('\n');
}

async function tonightTextByCity(cityInput) {
  if (!hasSupabaseConfig()) {
    return tonightText();
  }

  const city = cityInput ? canonicalCity(cityInput) : '';
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const [events, venues, reservations, guestLists, tickets, wavePassRequests, partnerApplications] = await Promise.all([
    supabaseRows('events', 'id,title,venue_name,market,event_date,start_time,end_time,status,created_at', {
      filters: [{ column: 'event_date', operator: 'eq', value: todayISO }],
      limit: 1000,
    }),
    supabaseRows('venues', 'id,name,market,type,status,created_at', { limit: 1000 }),
    supabaseRows('reservation_requests', 'id,user_name,market,venue_name,status,created_at', {
      filters: [{ column: 'created_at', operator: 'gte', value: `${todayISO}T00:00:00.000Z` }],
      limit: 1000,
    }),
    supabaseRows('guest_list_requests', 'id,user_name,event_title,market,status,created_at', {
      filters: [{ column: 'created_at', operator: 'gte', value: `${todayISO}T00:00:00.000Z` }],
      limit: 1000,
    }),
    supabaseRows('ticket_requests', 'id,user_name,event_title,ticket_type,status,created_at', {
      filters: [{ column: 'created_at', operator: 'gte', value: `${todayISO}T00:00:00.000Z` }],
      limit: 1000,
    }),
    supabaseRows('wave_pass_requests', 'id,full_name,market,status,created_at', {
      filters: [{ column: 'created_at', operator: 'gte', value: `${todayISO}T00:00:00.000Z` }],
      limit: 1000,
    }),
    supabaseRows('partner_applications', 'id,business_name,market,contact_name,status,created_at', {
      filters: [{ column: 'created_at', operator: 'gte', value: `${todayISO}T00:00:00.000Z` }],
      limit: 1000,
    }),
  ]);

  const results = [events, venues, reservations, guestLists, tickets, wavePassRequests, partnerApplications];
  const failure = results.find((result) => !result.ok);
  if (failure) {
    return [
      'Supabase query failed for tonight.',
      formatSupabaseTableLine('events', events),
      formatSupabaseTableLine('venues', venues),
      formatSupabaseTableLine('reservation_requests', reservations),
      formatSupabaseTableLine('guest_list_requests', guestLists),
      formatSupabaseTableLine('ticket_requests', tickets),
      formatSupabaseTableLine('wave_pass_requests', wavePassRequests),
      formatSupabaseTableLine('partner_applications', partnerApplications),
      'Please verify Railway env vars and RLS/select policies.',
    ].join('\n');
  }

  const cityEvents = rowsForCity(events.rows, city);
  const cityVenues = rowsForCity(venues.rows, city);
  const cityRequests = [
    ...rowsForCity(reservations.rows, city).map((row) => ({ table: 'reservation_requests', row })),
    ...rowsForCity(guestLists.rows, city).map((row) => ({ table: 'guest_list_requests', row })),
    ...rowsForCity(wavePassRequests.rows, city).map((row) => ({ table: 'wave_pass_requests', row })),
    ...rowsForCity(partnerApplications.rows, city).map((row) => ({ table: 'partner_applications', row })),
  ].sort((a, b) => new Date(b.row.created_at || 0).getTime() - new Date(a.row.created_at || 0).getTime());

  const cityLabel = city || 'all cities';
  return [
    `Tonight (${cityLabel}):`,
    ...cityEvents.slice(0, 5).map((row) => `- event | ${row.market || 'unknown'} | ${row.title || 'unknown'} | ${row.event_date || 'unknown date'} | ${row.venue_name || 'unknown venue'} | ${row.status || 'unknown'}`),
    ...cityVenues.slice(0, 5).map((row) => `- venue | ${row.market || 'unknown'} | ${row.name || 'unknown'} | ${row.type || 'unknown'} | ${row.status || 'unknown'}`),
    ...cityRequests.slice(0, 5).map(({ table, row }) => formatRequestRowSummary(table, row)),
    ...(cityEvents.length + cityVenues.length + cityRequests.length ? [] : ['- no matching Supabase rows found yet.']),
  ].join('\n');
}

async function weekendTextByCity(cityInput) {
  if (!hasSupabaseConfig()) {
    return 'Supabase is not configured for this worker yet.';
  }

  const city = cityInput ? canonicalCity(cityInput) : '';
  const today = new Date();
  const friday = new Date(today);
  friday.setDate(today.getDate() + ((5 - today.getDay() + 7) % 7));
  friday.setHours(0, 0, 0, 0);
  const sunday = new Date(friday);
  sunday.setDate(friday.getDate() + 2);

  const events = await supabaseRows('events', 'id,title,venue_name,market,event_date,start_time,end_time,status,created_at', {
    filters: [
      { column: EVENT_DATE_FIELD, operator: 'gte', value: rangeDateString(friday) },
      { column: EVENT_DATE_FIELD, operator: 'lte', value: rangeDateString(sunday) },
    ],
    order: { column: EVENT_DATE_FIELD, direction: 'asc' },
    limit: 1000,
  });

  const venues = await supabaseRows('venues', 'id,name,market,type,status,created_at', { limit: 1000 });
  if (!events.ok || !venues.ok) {
    return [
      'Supabase query failed for weekend.',
      formatSupabaseTableLine('events', events),
      formatSupabaseTableLine('venues', venues),
      'Please verify Railway env vars and RLS/select policies.',
    ].join('\n');
  }

  const cityEvents = rowsForCity(events.rows, city);
  const cityVenues = rowsForCity(venues.rows, city);
  const cityLabel = city || 'all cities';

  return [
    `Weekend (${cityLabel}):`,
    ...(cityEvents.length ? cityEvents.slice(0, 10).map((row) => formatEventSummary(row)) : ['- no matching weekend events found.']),
    ...(cityVenues.length ? cityVenues.slice(0, 5).map((row) => formatVenueSummary(row)) : ['- no matching venues found.']),
    'Note: weekend query uses Supabase event_date.',
  ].join('\n');
}

async function eventsCountText(cityInput) {
  if (!hasSupabaseConfig()) {
    return readOnlySupabaseUnavailableText();
  }
  const result = await supabaseRows('events', 'id,market', { limit: 1000 });
  if (!result.ok) {
    return [
      'Supabase query failed for events.',
      formatSupabaseTableLine('events', result),
      'Please verify Railway env vars and RLS/select policies.',
    ].join('\n');
  }
  const city = cityInput ? canonicalCity(cityInput) : '';
  const rows = city ? rowsForCity(result.rows, city) : (result.rows || []);
  const count = city ? rows.length : (result.count ?? rows.length);
  const label = city ? `Events in ${city}` : 'Events total';
  return `${label}: ${count}${count === 0 ? ' visible rows' : ''}`;
}

async function venuesCountText(cityInput) {
  if (!hasSupabaseConfig()) {
    return readOnlySupabaseUnavailableText();
  }
  const result = await supabaseRows('venues', 'id,market,type,status', { limit: 1000 });
  if (!result.ok) {
    return [
      'Supabase query failed for venues.',
      formatSupabaseTableLine('venues', result),
      'Please verify Railway env vars and RLS/select policies.',
    ].join('\n');
  }
  const city = cityInput ? canonicalCity(cityInput) : '';
  const rows = city ? rowsForCity(result.rows, city) : (result.rows || []);
  const count = city ? rows.length : (result.count ?? rows.length);
  const label = city ? `Venues in ${city}` : 'Venues total';
  return `${label}: ${count}${count === 0 ? ' visible rows' : ''}`;
}

async function requestCountText(cityInput) {
  if (!hasSupabaseConfig()) {
    return readOnlySupabaseUnavailableText();
  }
  const [reservations, guestLists, wavePassRequests, partnerApplications] = await Promise.all([
    supabaseRows('reservation_requests', 'id,market,created_at', { limit: 1000 }),
    supabaseRows('guest_list_requests', 'id,market,created_at', { limit: 1000 }),
    supabaseRows('wave_pass_requests', 'id,market,created_at', { limit: 1000 }),
    supabaseRows('partner_applications', 'id,market,created_at', { limit: 1000 }),
  ]);
  const results = [reservations, guestLists, wavePassRequests, partnerApplications];
  const failure = results.find((result) => !result.ok);
  if (failure) {
    return [
      'Supabase query failed for requests.',
      formatSupabaseTableLine('reservation_requests', reservations),
      formatSupabaseTableLine('guest_list_requests', guestLists),
      formatSupabaseTableLine('wave_pass_requests', wavePassRequests),
      formatSupabaseTableLine('partner_applications', partnerApplications),
      'Please verify Railway env vars and RLS/select policies.',
    ].join('\n');
  }
  const city = cityInput ? canonicalCity(cityInput) : '';
  const requestRows = [
    ...(city ? rowsForCity(reservations.rows, city) : reservations.rows || []),
    ...(city ? rowsForCity(guestLists.rows, city) : guestLists.rows || []),
    ...(city ? rowsForCity(wavePassRequests.rows, city) : wavePassRequests.rows || []),
    ...(city ? rowsForCity(partnerApplications.rows, city) : partnerApplications.rows || []),
  ];
  const count = city
    ? requestRows.length
    : (reservations.rows || []).length + (guestLists.rows || []).length + (wavePassRequests.rows || []).length + (partnerApplications.rows || []).length;
  const label = city ? `Requests in ${city}` : 'Requests total';
  return `${label}: ${count}${count === 0 ? ' visible rows' : ''}`;
}

async function askText() {
  const question = normalizeRequest(cmdText);
  const lower = question.toLowerCase();
  const city = detectCityFromText(question);

  if (/show\s+all\s+city\s+status|what\s+cities\s+have\s+data|cities\s+have\s+data/.test(lower)) {
    return citiesStatusText();
  }
  if (/operator brief|give me operator brief|show operator brief/.test(lower)) {
    return operatorBriefText();
  }
  if (/latest requests|show latest requests/.test(lower)) {
    return latestRequestsText();
  }
  if (/reservations today|show reservations today/.test(lower)) {
    return reservationsTodayText(city || '');
  }
  if (/ticket requests today|tickets today|show ticket requests today/.test(lower)) {
    return ticketsTodayText(city || '');
  }
  if (/guest list today|show guest list today/.test(lower)) {
    return guestListTodayText(city || '');
  }
  if (/what events are this week|events are this week|this week.*events/.test(lower)) {
    return eventsThisWeekText();
  }
  if (/what is happening tonight|happening tonight|tonight in/.test(lower)) {
    return tonightTextByCity(city || '');
  }
  if (/how many events/.test(lower)) {
    return eventsCountText(city || '');
  }
  if (/how many venues/.test(lower)) {
    return venuesCountText(city || '');
  }
  if (/show.*venues/.test(lower) || /show.*venue/.test(lower)) {
    return city ? cityBriefText(city) : venuesStatusText();
  }
  if (/show.*reservations today/.test(lower)) {
    return reservationsTodayText(city || '');
  }
  if (/show.*guest list today/.test(lower)) {
    return guestListTodayText(city || '');
  }
  if (/show.*ticket requests today/.test(lower)) {
    return ticketsTodayText(city || '');
  }
  if (/show miami brief|give me dallas brief|show la brief|show nyc brief|show nj brief|show philadelphia brief/.test(lower)) {
    return cityBriefText(city || detectCityFromText(question) || '');
  }
  if (/show.*city status/.test(lower) || /what cities have data/.test(lower)) {
    return citiesStatusText();
  }

  return [
    'I can answer these local data questions:',
    '- how many events do we have',
    '- how many venues do we have',
    '- what events are this week',
    '- what is happening tonight in Miami',
    '- show reservations today',
    '- show ticket requests today',
    '- show guest list today',
    '- show latest requests',
    '- give me operator brief',
    '- show Miami brief',
    '- show all city status',
    '',
    'Use /help for the full command list.',
  ].join('\n');
}

async function dataStatusText() {
  if (!hasSupabaseConfig()) {
    return readOnlySupabaseUnavailableText();
  }

  const tables = [
    ['reservation_requests', 'reservation_requests'],
    ['ticket_requests', 'ticket_requests'],
    ['guest_list_requests', 'guest_list_requests'],
    ['wave_pass_requests', 'wave_pass_requests'],
    ['partner_applications', 'partner_applications'],
  ];

  const results = await Promise.all(
    tables.map(async ([label, tableName]) => {
      const result = await supabaseSelect(tableName, { select: 'id', limit: 1 });
      return [label, result];
    }),
  );

  const lines = ['Supabase data status:', ''];
  for (const [label, result] of results) {
    lines.push(formatSupabaseTableLine(label, result));
  }
  return lines.join('\n');
}

function formatRequestSummary(tableName, row) {
  const createdAt = formatShortTime(row.created_at);
  if (tableName === 'reservation_requests') {
    return `- ${createdAt} | reservation | ${row.market || 'unknown market'} | ${row.venue_name || 'unknown venue'} | ${row.status || 'unknown'}`;
  }
  if (tableName === 'ticket_requests') {
    return `- ${createdAt} | ticket | ${row.event_title || 'unknown event'} | ${row.ticket_type || 'unknown type'} | ${row.status || 'unknown'}`;
  }
  return `- ${createdAt} | guest list | ${row.event_title || 'unknown event'} | party ${row.party_size || '1'} | ${row.status || 'unknown'}`;
}

async function requestsTodayText() {
  if (!hasSupabaseConfig()) {
    return readOnlySupabaseUnavailableText();
  }

  const today = new Date();
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const query = {
    filters: [
      { column: 'created_at', operator: 'gte', value: start.toISOString() },
      { column: 'created_at', operator: 'lt', value: end.toISOString() },
    ],
    order: { column: 'created_at', direction: 'desc' },
    limit: 5,
  };

  const [reservations, tickets, guestLists] = await Promise.all([
    supabaseSelect('reservation_requests', {
      select: 'id,user_name,market,venue_name,party_size,status,created_at',
      ...query,
    }),
    supabaseSelect('ticket_requests', {
      select: 'id,user_name,event_title,ticket_type,quantity,status,created_at',
      ...query,
    }),
    supabaseSelect('guest_list_requests', {
      select: 'id,user_name,event_title,market,party_size,arrival_time,status,created_at',
      ...query,
    }),
  ]);

  if (!reservations.ok || !tickets.ok || !guestLists.ok) {
    const failures = [
      ['reservation_requests', reservations],
      ['ticket_requests', tickets],
      ['guest_list_requests', guestLists],
    ]
      .filter(([, result]) => !result.ok)
      .map(([label, result]) => formatSupabaseTableLine(label, result));
    return ['Supabase query failed for one or more request tables.', ...failures, 'Please verify Railway env vars and RLS/select policies.'].join('\n');
  }

  const latest = [
    ...(reservations.rows || []).map((row) => ({ table: 'reservation_requests', row })),
    ...(tickets.rows || []).map((row) => ({ table: 'ticket_requests', row })),
    ...(guestLists.rows || []).map((row) => ({ table: 'guest_list_requests', row })),
  ]
    .sort((a, b) => new Date(b.row.created_at || 0).getTime() - new Date(a.row.created_at || 0).getTime())
    .slice(0, 5);

  const lines = [
    'Requests today:',
    `- reservation_requests: ${reservations.count ?? 0}`,
    `- ticket_requests: ${tickets.count ?? 0}`,
    `- guest_list_requests: ${guestLists.count ?? 0}`,
    '',
    'Latest few records:',
    ...(latest.length ? latest.map(({ table, row }) => formatRequestSummary(table, row)) : ['- none']),
  ];

  return lines.join('\n');
}

function formatWavePassSummary(row) {
  return `- ${formatShortTime(row.created_at)} | ${row.market || 'unknown market'} | ${row.status || 'unknown'} | ${row.nightlife_interest || 'no interest'} | ${row.full_name || 'unknown'}`;
}

async function wavePassRequestsText() {
  if (!hasSupabaseConfig()) {
    return readOnlySupabaseUnavailableText();
  }

  const result = await supabaseSelect('wave_pass_requests', {
    select: 'id,full_name,market,nightlife_interest,status,created_at',
    order: { column: 'created_at', direction: 'desc' },
    limit: 5,
  });

  if (!result.ok) {
    return [
      'Supabase query failed for wave_pass_requests.',
      formatSupabaseTableLine('wave_pass_requests', result),
      'Please verify Railway env vars and RLS/select policies.',
    ].join('\n');
  }

  return [
    `Wave Pass requests: ${result.count ?? 0}${(result.count ?? 0) === 0 ? ' visible rows' : ''}`,
    '',
    ...(result.rows.length ? result.rows.map((row) => formatWavePassSummary(row)) : ['- none']),
  ].join('\n');
}

function formatPartnerRequestSummary(row) {
  return `- ${formatShortTime(row.created_at)} | ${row.market || 'unknown market'} | ${row.business_name || 'unknown business'} | ${row.status || 'unknown'} | ${row.contact_name || 'unknown contact'}`;
}

async function partnerRequestsText() {
  if (!hasSupabaseConfig()) {
    return readOnlySupabaseUnavailableText();
  }

  const result = await supabaseSelect('partner_applications', {
    select: 'id,business_name,business_type,market,contact_name,contact_role,status,created_at',
    order: { column: 'created_at', direction: 'desc' },
    limit: 5,
  });

  if (!result.ok) {
    return [
      'Supabase query failed for partner_applications.',
      formatSupabaseTableLine('partner_applications', result),
      'Please verify Railway env vars and RLS/select policies.',
    ].join('\n');
  }

  return [
    `Partner applications: ${result.count ?? 0}${(result.count ?? 0) === 0 ? ' visible rows' : ''}`,
    '',
    ...(result.rows.length ? result.rows.map((row) => formatPartnerRequestSummary(row)) : ['- none']),
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
  '/tonight': () => tonightTextByCity(cmdText),
  '/weekend': () => weekendTextByCity(cmdText),
  '/events': eventsText,
  '/tickets': ticketsText,
  '/restaurants': restaurantsText,
  '/reservations': reservationsText,
  '/vip': vipText,
  '/money': moneyText,
  '/brief': briefText,
  '/data_status': dataStatusText,
  '/requests_today': requestsTodayText,
  '/wave_pass_requests': wavePassRequestsText,
  '/partner_requests': partnerRequestsText,
  '/events_status': eventsStatusText,
  '/events_this_week': eventsThisWeekText,
  '/venues_status': venuesStatusText,
  '/cities_status': citiesStatusText,
  '/reservations_today': reservationsTodayText,
  '/guest_list_today': guestListTodayText,
  '/tickets_today': ticketsTodayText,
  '/latest_requests': latestRequestsText,
  '/operator_brief': operatorBriefText,
  '/city_brief': () => cityBriefText(cmdText),
  '/ask': askText,
  '/make_prompt': makePromptText,
  '/draft_edit': draftEditText,
  '/draft_event': draftEventText,
  '/draft_price': draftPriceText,
  '/draft_mobile_fix': draftMobileFixText,
  '/draft_outreach': draftOutreachText,
  '/issue_draft': issueDraftText,
  '/build_draft': buildDraftText,
  '/qa_draft': qaDraftText,
  '/push_draft': pushDraftText,
  '/rollback_draft': rollbackDraftText,
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
  const output = await handler();
  console.log(output);
}
