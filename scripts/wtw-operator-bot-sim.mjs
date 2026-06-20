#!/usr/bin/env node
// WTW Operator Bot Simulator — local read-only prototype.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const cmd = process.argv[2] || '/help';
const __dirname = dirname(fileURLToPath(import.meta.url));
const mockDataPath = resolve(__dirname, '../_dev/mock/wtw-assistant-mock-data.json');
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

function helpText() {
  return [
    'WTW Operator Bot Simulator',
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
  ].join('\n');
}

function statusText() {
  const status = runGitStatus() || '(clean)';
  const log = runCapture('git', ['log', '--oneline', '-1']) || '(no commits found)';
  return [
    formatBlock('Git status', status),
    '',
    formatBlock('Latest commit', log),
    '',
    'Next known fix',
    '--------------',
    'Mobile overflow on index.html and events.html at 390px.',
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
    'Phone demo: almost, mobile overflow fix recommended first',
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
