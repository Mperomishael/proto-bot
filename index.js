import 'dotenv/config';
import fs from 'fs';                                // needed to wipe auth_info on bad codes
import pkg from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import * as allCmds from './commands/index.js';
import { PREFIX, OWNER_NUMBER, BOT_NAME, randomEmoji, isOwner } from './utils/helpers.js';
import { activity, invalidateGroup } from './utils/state.js';
import { autoSaveContact } from './utils/contacts.js';
import { sendBootSuccess } from './lib/welcome.js';
import { handlePublicPairRequest } from './lib/publicPair.js';
import { getAIResponse } from './lib/ai_logic.js';

// ─── Baileys CJS→ESM interop ─────────────────────────────────────────────────
const makeWASocket = pkg.default ?? pkg;
const { useMultiFileAuthState, DisconnectReason, Browsers } = pkg;

// ─── Command aliases ──────────────────────────────────────────────────────────
const ALIASES = { vv: 'viewonce', bank: 'showbank', bnk: 'banksettings' };

// ─── Auto-build command map ───────────────────────────────────────────────────
const cmdMap = new Map();
for (const [k, fn] of Object.entries(allCmds))
  if (k.startsWith('cmd')) cmdMap.set(k.slice(3).toLowerCase(), fn);

// ─── Wipe auth_info and restart fresh ────────────────────────────────────────
function wipeAndRestart(reason) {
  console.log(`\n🗑️  ${reason} — wiping auth_info/ and restarting fresh...\n`);
  try { fs.rmSync('auth_info', { recursive: true, force: true }); } catch {}
  setTimeout(startBot, 2000);
}

// Codes that mean the current session is permanently broken — must re-pair
const BAD_SESSION_CODES = new Set([
  401,  // loggedOut
  403,  // forbidden / banned
  405,  // ← the error you're seeing: session conflict / method not allowed
  411,  // multidevice mismatch
  500,  // bad session / corrupted creds
]);

let pairingCodeRequested = false;

async function startBot() {
  console.log(`⏳ Starting ${BOT_NAME}...`);
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({
    auth: state, logger: pino({ level: 'silent' }),
    printQRInTerminal: false, syncFullHistory: false,
    markOnlineOnConnect: true, browser: Browsers.macOS('Safari'),
    connectTimeoutMs: 60000, defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 30000, maxMsgRetryCount: 2,
  });

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {

    // ── Pairing code request ──────────────────────────────────────────────────
    if (qr && !state.creds.registered && !pairingCodeRequested) {
      pairingCodeRequested = true;
      console.log('🔌 Socket stable — waiting 8 s for handshake...');
      await new Promise(r => setTimeout(r, 8000));
      try {
        const code = await sock.requestPairingCode(OWNER_NUMBER.replace(/\D/g, ''));
        console.log('\n──────────────────────────────');
        console.log(`🔗 PAIRING CODE: ${code}`);
        console.log('──────────────────────────────\n');
        console.log('👉 In WhatsApp → Linked Devices → Link with phone number → enter code above');
      } catch (e) {
        console.error('❌ Pairing error:', e.message);
        pairingCodeRequested = false;
      }
    }

    // ── Connected ─────────────────────────────────────────────────────────────
    if (connection === 'open') {
      console.log(`\n✅ ${BOT_NAME} is ONLINE 🚀\n`);
      pairingCodeRequested = false;
      sendBootSuccess(sock).catch(e => console.error('boot msg failed:', e.message));
    }

    // ── Disconnected ─────────────────────────────────────────────────────────
    if (connection === 'close') {
      pairingCodeRequested = false;
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      console.log(`🔌 Disconnected — code ${code}`);

      if (BAD_SESSION_CODES.has(code)) {
        // Session is permanently broken — wipe and re-pair
        wipeAndRestart(`Code ${code}: session invalid / rejected by WhatsApp`);
      } else if (code === 515) {
        // restartRequired — reconnect with SAME creds (no wipe needed)
        console.log('🔄 Restart requested by server — reconnecting...');
        setTimeout(startBot, 2000);
      } else {
        // Transient network drop — reconnect with same creds
        console.log(`🔄 Network drop — reconnecting in 3 s...`);
        setTimeout(startBot, 3000);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' && type !== 'append') return;
    for (const msg of messages)
      if (msg.message) handleMessage(sock, msg).catch(e => console.error('❌', e.message));
  });

  sock.ev.on('messages.reaction', evs => {
    if (allCmds.handleReactionUpdate) evs.forEach(e => allCmds.handleReactionUpdate(e));
  });

  sock.ev.on('groups.update', us => us.forEach(u => u.id && invalidateGroup(u.id)));
  sock.ev.on('group-participants.update', e => invalidateGroup(e.id));
}

async function handleMessage(sock, msg) {
  const from = msg.key.remoteJid;
  if (!from || from === 'status@broadcast') return;
  const isGroup    = from.endsWith('@g.us');
  const fromMe     = msg.key.fromMe;
  const sender     = fromMe ? OWNER_NUMBER : (msg.key.participant || from);
  const isOwnerMsg = isOwner(sender);
  const botJid     = sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : '';
  const text       = msg.message?.conversation
                  || msg.message?.extendedTextMessage?.text
                  || msg.message?.imageMessage?.caption
                  || msg.message?.videoMessage?.caption || '';

  if (isGroup && !fromMe && allCmds.trackActivity) allCmds.trackActivity(from, sender);
  if (!fromMe) autoSaveContact(sock, sender).catch(() => {});
  if (allCmds.handleAntilink && isGroup && !isOwnerMsg)
    await allCmds.handleAntilink(sock, msg, from, sender);

  // steal: reply any message with '#'
  if (text === '#' && isOwnerMsg
      && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage)
    return allCmds.cmdSteal(sock, msg, from);

  // AI chat mode
  const chatOn      = activity[from]?.chatMode;
  const isRBot      = msg.message?.extendedTextMessage?.contextInfo?.participant === botJid;
  const isMentioned = text.includes('@' + botJid.split('@')[0]);
  if (chatOn && !text.startsWith(PREFIX) && (isRBot || isMentioned || !isGroup))
    return sock.sendMessage(from, { text: await getAIResponse(text) }, { quoted: msg });

  // public pair requests
  if (!fromMe && text && !text.startsWith(PREFIX))
    if (await handlePublicPairRequest(sock, msg, from, sender, text)) return;

  if (!text.startsWith(PREFIX) || !isOwnerMsg) return;

  const parts   = text.slice(PREFIX.length).trim().split(/\s+/);
  const command = parts[0]?.toLowerCase() || '';
  const args    = parts.slice(1);
  sock.sendMessage(from, { react: { text: randomEmoji(), key: msg.key } }).catch(() => {});
  try   { await runCommand(sock, msg, from, command, args, isGroup); }
  catch (e) { sock.sendMessage(from, { text: `❌ Error in .${command}: ${e.message}` }); }
}

async function runCommand(sock, msg, from, command, args, isGroup) {
  const resolved = ALIASES[command] || command;

  // .contact subcommand routing
  if (resolved === 'contact') {
    const sub = (args[0] || '').toLowerCase();
    const subFns = {
      list:      allCmds.cmdContactList,
      search:    allCmds.cmdContactSearch,
      save:      allCmds.cmdContactSave,
      delete:    allCmds.cmdContactDelete,
      export:    allCmds.cmdContactExport,
      autogroup: allCmds.cmdContactAutoGroup,
    };
    return subFns[sub]
      ? subFns[sub](sock, msg, from, args.slice(1), isGroup)
      : sock.sendMessage(from, { text: '📇 Subcommands: list | search | save | delete | export | autogroup' });
  }

  // .chat on/off AI toggle
  if (command === 'chat') {
    const on = args[0] === 'on';
    if (!activity[from]) activity[from] = {};
    activity[from].chatMode = on;
    return sock.sendMessage(from, { text: `🤖 *AI Chat:* ${on ? 'On ✅' : 'Off ❌'}` });
  }

  // auto-dispatch everything else via cmdMap
  const fn = cmdMap.get(resolved);
  if (fn) return fn(sock, msg, from, args, isGroup);

  await sock.sendMessage(from, {
    text: `❓ Unknown command: *${command}*\nType ${PREFIX}menu for the full list.`,
  });
}

process.on('uncaughtException',  e => console.error('🔥 Critical:', e));
process.on('unhandledRejection', e => console.error('🔥 Rejected:', e));
startBot();
