// lib/publicPair.js — Public pairing code issuer + DM handler.
// Spawns a dedicated child socket per user, requests a pairing code bound to
// THEIR phone number, sends it back to whoever asked, and cleans up.

import {
  default as makeWASocket,
  useMultiFileAuthState,
  Browsers,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { isOwner } from '../utils/helpers.js';

const SESSIONS_DIR = './sessions';
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

// Track active pairing attempts so a user can't spam-request codes
const activePairings = new Map(); // phone -> { sock, timeout }

// ============================================================
//  HELPERS
// ============================================================
export function normalizePhone(input) {
  return String(input || '').replace(/\D/g, '');
}

// ============================================================
//  CORE: ISSUE A PAIRING CODE FOR A GIVEN NUMBER
// ============================================================
export async function issuePairingCode(mainSock, requesterJid, rawPhone) {
  const phone = normalizePhone(rawPhone);
  const NL = String.fromCharCode(10);

  // Validate phone
  if (!phone || phone.length < 8 || phone.length > 15) {
    await mainSock.sendMessage(requesterJid, {
      text: '❌ *Invalid number.*' + NL + NL +
            'Send your full international number with country code, e.g.' + NL +
            '`2347086757575` or `+2347086757575`'
    });
    return;
  }

  // Already pairing? Block duplicate request.
  if (activePairings.has(phone)) {
    await mainSock.sendMessage(requesterJid, {
      text: '⏳ A pairing code was already sent for *' + phone + '*.' + NL +
            'Please wait for it to expire (90s) before requesting again.'
    });
    return;
  }

  const sessionPath = path.join(SESSIONS_DIR, phone);

  // Clean any stale half-paired session for this number
  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true });
  }

  console.log('🔧 Spawning pairing socket for ' + phone + '...');

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  const childSock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    browser: Browsers.ubuntu('Chrome'),
    generateHighQualityLinkPreview: false,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
  });

  childSock.ev.on('creds.update', saveCreds);

  // Wait for the Noise handshake to fully settle before requesting code.
  await new Promise(r => setTimeout(r, 4500));

  // Guard: confirm the socket actually initialized auth state
  if (!childSock.authState?.creds) {
    console.error('❌ Auth state failed to initialize for ' + phone);
    await mainSock.sendMessage(requesterJid, {
      text: '❌ Auth state failed to initialize. Try again in a minute.'
    });
    try { childSock.end(); } catch {}
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }
    return;
  }

  let code;
  try {
    code = await childSock.requestPairingCode(phone);
  } catch (e) {
    console.error('❌ requestPairingCode failed for ' + phone + ':', e.message);
    await mainSock.sendMessage(requesterJid, {
      text: '❌ Could not generate a pairing code right now. Try again in a minute.'
    });
    try { childSock.end(); } catch {}
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }
    return;
  }

  const formatted = code.match(/.{1,4}/g)?.join('-') || code;

  const message =
    '╭━━━━━━━━━━━━━━━━━━━━╮' + NL +
    '┃  🔗 YOUR PAIRING CODE  ┃' + NL +
    '╰━━━━━━━━━━━━━━━━━━━━╯' + NL + NL +
    '📱 *For number:* ' + phone + NL + NL +
    '👉 *Tap to copy:*' + NL +
    '```' + code + '```' + NL + NL +
    '*Formatted:* `' + formatted + '`' + NL + NL +
    '━━━━━━━━━━━━━━━━━━━━━━' + NL +
    '*How to use:*' + NL +
    '1️⃣  Open WhatsApp on your phone' + NL +
    '2️⃣  Settings → Linked Devices' + NL +
    '3️⃣  Tap *Link a Device*' + NL +
    '4️⃣  Tap *Link with phone number instead*' + NL +
    '5️⃣  Paste the 8 characters above' + NL +
    '━━━━━━━━━━━━━━━━━━━━━━' + NL + NL +
    '⏱  *Expires in 60-90 seconds — be quick!*' + NL +
    '⚠️  Never share this code with anyone else.';

  await mainSock.sendMessage(requesterJid, { text: message });
  console.log('✅ Pairing code sent to ' + requesterJid + ' for number ' + phone + ' (code: ' + formatted + ')');

  // Auto-cleanup: kill child socket and wipe session if not linked within 90s
  const timeout = setTimeout(() => {
    console.log('🧹 Cleaning up unused pairing session for ' + phone);
    try { childSock.end(); } catch {}
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }
    activePairings.delete(phone);
  }, 90 * 1000);

  // Success notifier (used by both 'open' and 515 close paths)
  const notifySuccess = () => {
    clearTimeout(timeout);
    activePairings.delete(phone);
    mainSock.sendMessage(requesterJid, {
      text: '✅ *Pairing successful!*' + NL +
            'Your number *' + phone + '* is now linked.' + NL +
            'You can close this chat — your session is saved.'
    }).catch(() => {});
  };

  let alreadyNotified = false;

  childSock.ev.on('connection.update', (u) => {
    const { connection, lastDisconnect } = u;

    if (connection === 'open' && !alreadyNotified) {
      alreadyNotified = true;
      console.log('🎉 ' + phone + ' completed pairing — session persisted at ' + sessionPath);
      notifySuccess();
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      const errMsg = lastDisconnect?.error?.message || 'unknown';
      console.log('⚠️ Pairing socket closed for ' + phone + ' (code: ' + reason + ', reason: ' + errMsg + ')');

      // Code 515 = "restart required" — Baileys' standard signal that pairing
      // SUCCEEDED and credentials are now written to disk. We treat it as success.
      if (reason === 515 && !alreadyNotified) {
        alreadyNotified = true;
        console.log('   ✓ Code 515 = pairing SUCCESS for child socket — keys saved.');
        notifySuccess();
      }
    }
  });

  // Register this pairing so duplicate requests are blocked
  activePairings.set(phone, { sock: childSock, timeout });
}

// ============================================================
//  PUBLIC DM HANDLER — auto-detects "user sent their number"
// ============================================================
export async function handlePublicPairRequest(sock, msg, from, sender, text) {
  // Only act in DMs, never in groups or status
  if (from.endsWith('@g.us') || from === 'status@broadcast') return false;

  // Owner uses .pair — skip auto-detection for them
  if (isOwner(sender)) return false;

  if (!text) return false;

  const cleaned = normalizePhone(text);

  // Heuristic: trimmed text is mostly digits/+/-/()/spaces, 8–20 chars,
  // and the digit count is between 8 and 15
  const looksLikeNumber =
    /^[\s+\-()0-9]{8,20}$/.test(text.trim()) &&
    cleaned.length >= 8 &&
    cleaned.length <= 15;

  if (!looksLikeNumber) return false;

  await issuePairingCode(sock, from, cleaned);
  return true; // signal that we handled this message
}
