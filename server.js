// server.js — Public session-ID generator portal for EMPIRE BOT-WAN.
// Run on a persistent Node host (Hetzner, Oracle, Render Starter, VPS).

import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import {
  default as makeWASocket,
  useMultiFileAuthState,
  Browsers,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { encodeSession } from './lib/sessionId.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const BRAND = process.env.BRAND_NAME || 'EMPIRE BOT-WAN';
const PAIR_TIMEOUT_MS = parseInt(process.env.PAIR_TIMEOUT_MS || '300000', 10);
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_HOUR || '20', 10);
const SESSIONS_DIR = './sessions';

console.log('🚀 ' + BRAND + ' portal booting on ' + HOST + ':' + PORT);

if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

const pending = new Map();

const app = express();
app.use(express.json());
app.set('trust proxy', 1);
app.use(express.static(path.join(__dirname, 'public')));

const pairLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many pairing requests from this IP. Try again later.' },
});

function normalizePhone(input) {
  return String(input || '').replace(/\D/g, '');
}

function cleanupEntry(phone) {
  const entry = pending.get(phone);
  if (!entry) return;
  try { entry.sock?.end?.(); } catch { }
  if (entry.sessionPath && fs.existsSync(entry.sessionPath)) {
    fs.rmSync(entry.sessionPath, { recursive: true, force: true });
  }
  pending.delete(phone);
}

app.post('/api/pair', pairLimiter, async (req, res) => {
  const phone = normalizePhone(req.body?.phone);

  if (!phone || phone.length < 8 || phone.length > 15) {
    return res.status(400).json({ ok: false, error: 'Invalid phone number. Use international format (e.g. 2348012345678).' });
  }

  const existing = pending.get(phone);
  if (existing && existing.status === 'awaiting') {
    return res.json({ ok: true, code: existing.code, formatted: existing.formatted, phone });
  }

  const sessionPath = path.join(SESSIONS_DIR, phone);
  if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      // 🔑 The fingerprint WhatsApp's pairing endpoint actually accepts in 2026
      browser: Browsers.macOS('Safari'),
      generateHighQualityLinkPreview: false,
    });

    sock.ev.on('creds.update', saveCreds);

    // Wait for the Noise handshake to fully settle before requesting code.
    // Faster hosts may complete in 2s, slower ones need 4-5s.
    await new Promise(r => setTimeout(r, 4500));

    if (!sock.authState?.creds) {
      throw new Error('Auth state failed to initialize');
    }

    const code = await sock.requestPairingCode(phone);
    const formatted = code.match(/.{1,4}/g)?.join('-') || code;

    const entry = {
      code, formatted,
      status: 'awaiting',
      sock, sessionPath,
      sessionId: null,
      createdAt: Date.now(),
    };
    pending.set(phone, entry);

    sock.ev.on('connection.update', (u) => {
      const { connection, lastDisconnect } = u;

      if (connection === 'open') {
        try {
          const sessionId = encodeSession(sessionPath);
          entry.sessionId = sessionId;
          entry.status = 'ready';
          console.log('🎉 Pairing complete for ' + phone);
          // Keep the socket alive a beat so WhatsApp finalizes its side,
          // then close cleanly so the user's device owns the slot.
          setTimeout(() => { try { sock.end(); } catch { } }, 2500);
        } catch (e) {
          console.error('encode failed:', e.message);
          entry.status = 'error';
          entry.errorMessage = e.message;
        }
      }

      if (connection === 'close' && entry.status === 'awaiting') {
        const reason = lastDisconnect?.error?.output?.statusCode;
        console.log('⚠️ Socket closed for ' + phone + ' before pairing (code: ' + reason + ')');
        entry.status = 'expired';
      }
    });

    setTimeout(() => {
      const e = pending.get(phone);
      if (e && e.status === 'awaiting') {
        e.status = 'expired';
        cleanupEntry(phone);
      }
    }, PAIR_TIMEOUT_MS);

    console.log('📨 Code issued for ' + phone + ': ' + formatted);
    res.json({ ok: true, code, formatted, phone });
  } catch (e) {
    console.error('pair api error for ' + phone + ':', e.message);
    cleanupEntry(phone);
    res.status(500).json({ ok: false, error: 'Could not generate pairing code. Try again in a minute.' });
  }
});

app.get('/api/status/:phone', (req, res) => {
  const phone = normalizePhone(req.params.phone);
  const entry = pending.get(phone);
  if (!entry) return res.status(404).json({ ok: false, error: 'No pending pairing for this number.' });

  res.json({
    ok: true,
    status: entry.status,
    sessionId: entry.status === 'ready' ? entry.sessionId : null,
    error: entry.errorMessage || null,
  });
});

app.post('/api/done/:phone', (req, res) => {
  const phone = normalizePhone(req.params.phone);
  cleanupEntry(phone);
  res.json({ ok: true });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, brand: BRAND, pending: pending.size, uptime: process.uptime() });
});

app.listen(PORT, HOST, () => {
  console.log('🌐 ' + BRAND + ' pairing portal running on http://' + HOST + ':' + PORT);
  console.log('   Browser fingerprint: macOS Safari');
  console.log('   Rate limit: ' + RATE_LIMIT + ' requests/IP/hour');
  console.log('   Pair timeout: ' + (PAIR_TIMEOUT_MS / 1000) + 's');
});

function shutdown() {
  console.log('🛑 Shutting down — cleaning ' + pending.size + ' pending pairings...');
  for (const phone of pending.keys()) cleanupEntry(phone);
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (e) => console.error('🔥 uncaught:', e?.message || e));
process.on('unhandledRejection', (e) => console.error('🔥 unhandled:', e?.message || e));
