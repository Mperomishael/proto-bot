import 'dotenv/config';
import makeWASocket, {
  useMultiFileAuthState, DisconnectReason, Browsers
} from '@whiskeysockets/baileys';
import { Boom }    from '@hapi/boom';
import pino        from 'pino';

import * as allCmds from './commands/index.js';
import { PREFIX, OWNER_NUMBER, BOT_NAME,
         randomEmoji, isOwner }     from './utils/helpers.js';
import { reactions, activity,
         invalidateGroup }          from './utils/state.js';
import { autoSaveContact }          from './utils/contacts.js';

// ── Build command map automatically from all cmd* exports ──
const cmdMap = new Map();
for (const [key, fn] of Object.entries(allCmds)) {
  if (key.startsWith('cmd')) {
    cmdMap.set(key.slice(3).toLowerCase(), fn); // e.g. cmdKick → 'kick'
  }
}

let pairingCodeRequested = false;

async function startBot() {
  console.log(`⏳ Starting ${BOT_NAME}...`);
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  const sock = makeWASocket({
    auth:                  state,
    logger:                pino({ level: 'silent' }),
    printQRInTerminal:     false,
    syncFullHistory:       false,
    markOnlineOnConnect:   true,
    browser:               Browsers.macOS('Safari'),
    connectTimeoutMs:      60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs:   30000,
    maxMsgRetryCount:      2,       // Prevents RAM loops on Termux
  });

  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect, qr } = u;

    if (qr && !state.creds.registered && !pairingCodeRequested) {
      pairingCodeRequested = true;
      console.log('🔌 Waiting 8s for handshake...');
      await new Promise(r => setTimeout(r, 8000));
      try {
        const code = await sock.requestPairingCode(OWNER_NUMBER.replace(/\D/g, ''));
        console.log(`\n🔗 PAIRING CODE: ${code}\n`);
      } catch (e) {
        console.error('❌ Pairing error:', e.message);
        pairingCodeRequested = false;
      }
    }

    if (connection === 'open') {
      console.log(`✅ ${BOT_NAME} is ONLINE`);
      pairingCodeRequested = false;
    }

    if (connection === 'close') {
      pairingCodeRequested = false;
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) {
        console.log(`🔄 Reconnecting... (code ${code})`);
        setTimeout(startBot, 3000);
      } else {
        console.log('🚪 Logged out. Delete auth_info and restart.');
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' && type !== 'append') return;
    for (const msg of messages) {
      if (!msg.message) continue;
      handleMessage(sock, msg).catch(e =>
        console.error('❌ Handler crash:', e.message));
    }
  });

  sock.ev.on('groups.update', us => us.forEach(u => u.id && invalidateGroup(u.id)));
  sock.ev.on('group-participants.update', e => invalidateGroup(e.id));
}

async function handleMessage(sock, msg) {
  const from     = msg.key.remoteJid;
  if (!from || from === 'status@broadcast') return;

  const isGroup  = from.endsWith('@g.us');
  const fromMe   = msg.key.fromMe;
  const sender   = fromMe ? OWNER_NUMBER : (msg.key.participant || from);
  const isOwnerMsg = isOwner(sender);
  const text     = msg.message?.conversation
                || msg.message?.extendedTextMessage?.text
                || msg.message?.imageMessage?.caption
                || msg.message?.videoMessage?.caption || '';

  if (isGroup && !fromMe && allCmds.trackActivity)
    allCmds.trackActivity(from, sender);

  if (!fromMe) autoSaveContact(sock, sender).catch(() => {});

  if (allCmds.handleAntilink && isGroup && !isOwnerMsg)
    await allCmds.handleAntilink(sock, msg, from, sender);

  if (!text.startsWith(PREFIX)) return;
  if (!isOwnerMsg) return;

  const parts   = text.slice(PREFIX.length).trim().split(/\s+/);
  const command = parts[0]?.toLowerCase() || '';
  const args    = parts.slice(1);

  sock.sendMessage(from, { react: { text: randomEmoji(), key: msg.key } })
      .catch(() => {});

  const handler = cmdMap.get(command);
  if (handler) {
    try {
      await handler(sock, msg, from, args, isGroup);
    } catch (e) {
      await sock.sendMessage(from, { text: `❌ Error in .${command}: ${e.message}` });
    }
  } else {
    await sock.sendMessage(from, { text: `❓ Unknown command: *${PREFIX}${command}*\nType *${PREFIX}menu* for help.` });
  }
}

process.on('uncaughtException',   e => console.error('🔥 Critical:', e));
process.on('unhandledRejection',  e => console.error('🔥 Rejected:', e));

startBot();
