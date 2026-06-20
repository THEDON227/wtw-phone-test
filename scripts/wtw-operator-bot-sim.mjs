#!/usr/bin/env node
// WTW Operator Bot Simulator — local read-only prototype.

import { execFileSync, spawnSync } from 'node:child_process';

const cmd = process.argv[2] || '/help';

function runGitStatus() {
  return runCapture('git', ['status', '--short']);
}

function runGitLog() {
  return runCapture('git', ['log', '--oneline', '-5']);
}

function runReadOnlyScript(scriptPath) {
  return runCapture('bash', [scriptPath]);
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
