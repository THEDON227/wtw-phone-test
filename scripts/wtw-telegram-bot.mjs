#!/usr/bin/env node
// WTW Telegram Bot Wrapper — local read-only bridge to the operator bot simulator.

import { execFileSync } from 'node:child_process';
import { request as httpsRequest } from 'node:https';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const simulatorPath = resolve(repoRoot, 'scripts/wtw-operator-bot-sim.mjs');
const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const allowedChatId = (process.env.WTW_TELEGRAM_ALLOWED_CHAT_ID || '').trim();

const supportedCommands = new Set([
  '/whoami',
  '/help',
  '/status',
  '/logs',
  '/next',
  '/draft_edit',
  '/draft_event',
  '/draft_price',
  '/draft_mobile_fix',
  '/draft_outreach',
  '/issue_draft',
  '/build_draft',
  '/qa_draft',
  '/push_draft',
  '/rollback_draft',
]);

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function jsonRequest(method, path, body) {
  const url = new URL(`https://api.telegram.org/bot${token}${path}`);
  const payload = body ? JSON.stringify(body) : null;

  return new Promise((resolvePromise, rejectPromise) => {
    const req = httpsRequest(
      url,
      {
        method,
        headers: payload
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            }
          : undefined,
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolvePromise(parsed);
          } catch (error) {
            rejectPromise(new Error(`Failed to parse Telegram response: ${data || res.statusCode}`));
          }
        });
      },
    );

    req.on('error', rejectPromise);

    if (payload) {
      req.write(payload);
    }

    req.end();
  });
}

async function telegram(path, body) {
  return jsonRequest(body ? 'POST' : 'GET', path, body);
}

function splitMessage(text, limit = 3900) {
  const chunks = [];
  let remaining = text || '';

  while (remaining.length > limit) {
    let cut = remaining.lastIndexOf('\n', limit);
    if (cut < 120) {
      cut = limit;
    }
    chunks.push(remaining.slice(0, cut).trimEnd());
    remaining = remaining.slice(cut).trimStart();
  }

  if (remaining.length) {
    chunks.push(remaining);
  }

  return chunks.length ? chunks : [''];
}

function runSimulator(command, args = []) {
  try {
    return execFileSync(
      'node',
      [simulatorPath, command, ...args],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
      },
    ).trimEnd();
  } catch (error) {
    const stdout = error?.stdout ? String(error.stdout).trimEnd() : '';
    const stderr = error?.stderr ? String(error.stderr).trimEnd() : '';
    return [stdout, stderr].filter(Boolean).join('\n') || `Unknown command. Use /help.`;
  }
}

async function sendMessage(chatId, text, replyToMessageId) {
  for (const chunk of splitMessage(text)) {
    await telegram('/sendMessage', {
      chat_id: chatId,
      text: chunk,
      disable_web_page_preview: true,
      ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
    });
  }
}

function telegramHelpText() {
  return [
    'WTW Telegram Wrapper',
    '',
    'This wrapper is read-only. It routes messages into the local WTW Operator Bot simulator and does not edit files, push code, write to Supabase, or message anyone.',
    '',
    'Telegram-only commands:',
    '/whoami - show your Telegram chat ID',
    '',
    'All simulator commands still work:',
    '/help',
    '/status',
    '/logs',
    '/next',
    '/draft_edit',
    '/draft_event',
    '/draft_price',
    '/draft_mobile_fix',
    '/draft_outreach',
    '/issue_draft',
    '/build_draft',
    '/qa_draft',
    '/push_draft',
    '/rollback_draft',
    '',
    'Safety reminder:',
    'Public site stays frozen unless fixing a real bug. Build requires APPROVE BUILD. Push requires APPROVE PUSH. Rollback requires APPROVE ROLLBACK.',
  ].join('\n');
}

async function getAllowedUpdate(waitMs = 30) {
  const url = new URL(`https://api.telegram.org/bot${token}/getUpdates`);
  url.searchParams.set('timeout', String(waitMs));
  url.searchParams.set('allowed_updates', JSON.stringify(['message']));
  if (offset > 0) {
    url.searchParams.set('offset', String(offset));
  }
  return telegram(`${url.pathname}${url.search}`);
}

let offset = 0;

function parseCommand(text) {
  const raw = (text || '').trim();
  if (!raw.startsWith('/')) {
    return { command: '', args: [] };
  }

  const parts = raw.split(/\s+/);
  const commandToken = parts[0] || '';
  const command = commandToken.split('@')[0].toLowerCase();
  return { command, args: parts.slice(1) };
}

async function handleUpdate(update) {
  const message = update?.message;
  if (!message || typeof message.text !== 'string') {
    return;
  }

  const chatId = String(message.chat?.id ?? '');
  const userId = String(message.from?.id ?? '');
  const rawText = message.text;
  const { command, args } = parseCommand(rawText);

  console.log(`WTW Telegram message: chat_id=${chatId} command=${command || '(none)'} raw_text=${JSON.stringify(rawText)}`);

  if (!command) {
    await sendMessage(chatId, 'Unknown command. Use /help.', message.message_id);
    return;
  }

  if (command === '/whoami') {
    await sendMessage(
      chatId,
      [
        'WTW Telegram identity',
        `chat_id: ${chatId}`,
        `chat_type: ${message.chat?.type || 'unknown'}`,
        `user_id: ${userId || 'unknown'}`,
        `from_username: ${message.from?.username || 'unknown'}`,
        `message_text: ${rawText}`,
        '',
        'Use this chat ID to restart the bot with WTW_TELEGRAM_ALLOWED_CHAT_ID.',
      ].join('\n'),
      message.message_id,
    );
    return;
  }

  if (allowedChatId && chatId !== allowedChatId) {
    await sendMessage(chatId, 'WTW Telegram bot blocked: this chat is not allowlisted.', message.message_id);
    return;
  }

  if (command === '/help') {
    await sendMessage(chatId, telegramHelpText(), message.message_id);
    return;
  }

  if (!supportedCommands.has(command)) {
    await sendMessage(chatId, 'Unknown command. Use /help.', message.message_id);
    return;
  }

  const output = runSimulator(command, args);
  await sendMessage(chatId, output || 'No output.', message.message_id);
}

async function pollLoop() {
  console.log('WTW Telegram wrapper started. Send /whoami from Telegram to get your chat ID.');

  while (true) {
    try {
      const response = await telegram(`/getUpdates?timeout=30${offset > 0 ? `&offset=${offset}` : ''}&allowed_updates=${encodeURIComponent(JSON.stringify(['message']))}`);
      if (!response?.ok) {
        throw new Error(`Telegram returned not ok: ${JSON.stringify(response)}`);
      }

      const updates = Array.isArray(response.result) ? response.result : [];
      for (const update of updates) {
        if (typeof update.update_id === 'number') {
          offset = Math.max(offset, update.update_id + 1);
        }
        await handleUpdate(update);
      }
    } catch (error) {
      console.error(`WTW Telegram wrapper error: ${error.message}`);
      await sleep(2000);
    }
  }
}

if (!token) {
  console.error('Missing TELEGRAM_BOT_TOKEN.');
  console.error('Set TELEGRAM_BOT_TOKEN and run again.');
  process.exit(1);
}

pollLoop().catch((error) => {
  console.error(`WTW Telegram wrapper fatal error: ${error.message}`);
  process.exit(1);
});
