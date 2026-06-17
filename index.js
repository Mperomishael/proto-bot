// ============================================================
//  EMPIRE BOT-WAN (PROTOTYPE) — index.js
//  Owner-only WhatsApp bot with pairing code + System Control
// ============================================================

import { default as makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import pino from 'pino';

// ====== COMMAND IMPORTS ======
import {
  cmdPing, cmdHelp, cmdList, cmdMenu, cmdProfile,
  cmdViewOnce, cmdSend,
  cmdInfo, cmdTagAll,
  cmdKick, cmdPromote, cmdDemote,
  cmdSubject, cmdLink,
  handleAntilink, cmdAntilink,
  cmdActive, cmdInactive, cmdResetActivity, trackActivity,
  cmdDk,
  trackReactions, handleReactionUpdate, cmdReactions, cmdReacted, cmdNotReacted, cmdClearReactions, cmdReactionStats,
  cmdContactList, cmdContactSearch, cmdContactSave, cmdContactDelete,
  cmdContactExport, cmdContactAutoGroup, cmdContactHelp,
  // System Commands
  cmdUpdate, cmdReboot 
} from './commands/index.js';

// ====== UTILITY IMPORTS ======
import {
  PREFIX, OWNER_NUMBER, BOT_NAME, randomEmoji, isOwner
} from './utils/helpers.js';

import {
  antilinkGroups, activity, domainKing, statusLog, reactions,
  getGroupMeta, invalidateGroup,
  STATUS_LOG_FILE, ACTIVITY_FILE, DOMAIN_KING_FILE, REACTIONS_FILE, save
} from './utils/state.js';

import { autoSaveContact } from './utils/contacts.js';

// ====== PAIRING / WELCOME / PUBLIC PAIR ======
import { setupPairing } from './lib/pairing.js';
import { sendBootSuccess } from './lib/welcome.js';
import { handlePublicPairRequest } from './lib/publicPair.js';
import { cmdPair } from './commands/pair.js';

// ============================================================
//  MAIN START
// ============================================================
async function startBot() {
  console.log('⏳ Starting ' + BOT_NAME + '...');

  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    shouldIgnoreJid: () => false,
    browser: Browsers.ubuntu('Chrome'), 
    generateHighQualityLinkPreview: false,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
  });

  // ====== PAIRING CODE — only runs on first launch ======
  if (!state.creds.registered) {
    setupPairing(sock, OWNER_NUMBER).catch(e => console.error('pairing error:', e.message));
  }

  // ====== CONNECTION HANDLER ======
  sock.ev.on('connection.update', (u) => {
    const { connection, lastDisconnect, qr } = u;

    if (qr) {
      console.log(String.fromCharCode(10) + '📱 Scan this QR (WhatsApp → Linked Devices):' + String.fromCharCode(10));
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'connecting') console.log('🔌 Connecting...');

    if (connection === 'open') {
      console.log('✅ ' + BOT_NAME + ' is ONLINE');
      console.log('   Bot JID: ' + sock.user?.id);
      console.log('   Owner:   ' + OWNER_NUMBER);
      sendBootSuccess(sock).catch(e => console.error('boot dm:', e.message));
    }

    if (connection === 'close') {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const reason = lastDisconnect?.error?.message || 'unknown';
      console.log('❌ Disconnected. Code:', code, 'Reason:', reason);

      if (code === 515) {
        console.log('🔄 Restart required after pairing — reconnecting...');
        setTimeout(startBot, 2000);
      } else if (code === DisconnectReason.loggedOut) {
        console.log('🚪 Logged out. Delete auth_info/ to re-pair.');
      } else {
        console.log('🔄 Reconnecting in 3s...');
        setTimeout(startBot, 3000);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('groups.update', (us) => us.forEach(u => u.id && invalidateGroup(u.id)));
  sock.ev.on('group-participants.update', (e) => invalidateGroup(e.id));

  // ====== REACTIONS TRACKER ======
  sock.ev.on('messages.update', (updates) => {
    updates.forEach(update => {
      try {
        handleReactionUpdate(reactions, update);
        if (update?.key?.remoteJid) save(REACTIONS_FILE, reactions);
      } catch (e) {
        console.error('reaction update error:', e.message);
      }
    });
  });

  // ====== MESSAGE DISPATCHER ======
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    // Note: Termux/Wakelock sometimes causes 'append' type for owner messages.
    // We process both 'notify' and 'append' to ensure reliability.
    if (type !== 'notify' && type !== 'append') return;
    for (const msg of messages) {
      handleMessage(sock, msg).catch(e => console.error('❌ handler crash:', e.message));
    }
  });

  console.log('✅ Event listeners registered.');
}

// ============================================================
//  MESSAGE HANDLER
// ============================================================
async function handleMessage(sock, msg) {
  if (!msg.message) return;

  const from = msg.key.remoteJid;
  if (!from) return;

  const isStatus = from === 'status@broadcast';
  const isGroup  = from.endsWith('@g.us');
  const fromMe   = msg.key.fromMe === true;

  const botJid = sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : '';

  let sender;
  if (fromMe) sender = OWNER_NUMBER;
  else        sender = msg.key.participant || from;

  const ownerIsSender = isOwner(sender);

  const text =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    msg.message.videoMessage?.caption ||
    '';

  // ===== LOG INCOMING =====
  if (text || msg.message.imageMessage || msg.message.videoMessage) {
    const tag = isStatus ? '📸 STATUS' : isGroup ? '👥 GROUP' : '💬 DM';
    const preview = text.length > 60 ? text.slice(0, 60) + '...' : text;
    console.log(tag + ' [' + sender.split('@')[0] + '] ' + (fromMe ? '(me)' : '') + ': ' + (preview || '(media)'));
  }

  if (isStatus) {
    sock.readMessages([msg.key]).catch(() => {});
    sock.sendMessage('status@broadcast', { react: { key: msg.key, text: '💚' } }, { statusJidList: [msg.key.participant] }).catch(() => {});
    return;
  }

  if (isGroup && !fromMe) trackActivity(from, sender);
  if (!fromMe) autoSaveContact(sock, sender).catch(() => {});

  // ===== REACTION MAPPING =====
  if (isGroup && msg.key.id) {
    if (!reactions[from]) reactions[from] = {};
    if (!reactions[from][msg.key.id]) {
      const today = new Date();
      reactions[from][msg.key.id] = {
        from: sender,
        isAdmin: ownerIsSender,
        timestamp: msg.messageTimestamp || Date.now(),
        date: today.toISOString().split('T')[0],
        reactions: {}
      };
      save(REACTIONS_FILE, reactions);
    }
  }

  if (isGroup && !fromMe && !ownerIsSender) {
    const blocked = await handleAntilink(sock, msg, sender, from, text, botJid);
    if (blocked) return;
  }

  // ===== PUBLIC PAIRING =====
  if (!fromMe && text) {
    const handled = await handlePublicPairRequest(sock, msg, from, sender, text);
    if (handled) return;
  }

  // ===== COMMAND PARSER =====
  if (!text || !text.startsWith(PREFIX)) return;

  if (!ownerIsSender) {
    console.log('🔒 Blocked: ' + sender + ' tried command');
    return;
  }

  const parts = text.slice(PREFIX.length).trim().split(/\s+/);
  const command = parts[0]?.toLowerCase() || '';
  const args = parts.slice(1);

  console.log('⚡ COMMAND: ' + command + ' args=' + JSON.stringify(args));
  sock.sendMessage(from, { react: { text: randomEmoji(), key: msg.key } }).catch(() => {});

  try {
    await runCommand(sock, msg, from, command, args, isGroup);
    console.log('   ✓ done');
  } catch (e) {
    console.error('   ✗ failed:', e.message);
    sock.sendMessage(from, { text: '❌ ' + e.message }).catch(() => {});
  }
}

// ============================================================
//  COMMAND ROUTER
// ============================================================
async function runCommand(sock, msg, from, command, args, isGroup) {
  try {
    switch (command) {
      case 'ping':    return cmdPing(sock, msg, from);
      case 'help':    return cmdHelp(sock, msg, from);
      case 'list':    return cmdList(sock, msg, from);
      case 'menu':    return cmdMenu(sock, msg, from);
      case 'dp':      return cmdProfile(sock, msg, from, args);
      case 'vv':
      case 'save':    return cmdViewOnce(sock, msg, from);
      case 'send':    return cmdSend(sock, msg, from);
      case 'pair':    return cmdPair(sock, msg, from, args);
      
      // System Controls
      case 'update':  return cmdUpdate(sock, msg, from);
      case 'reboot':
      case 'restart': return cmdReboot(sock, msg, from);

      case 'contact': {
        const sub = (args[0] || '').toLowerCase();
        if (sub === 'list')   return cmdContactList(sock, msg, from, args.slice(1));
        if (sub === 'search') return cmdContactSearch(sock, msg, from, args.slice(1));
        if (sub === 'save')   return cmdContactSave(sock, msg, from, args.slice(1));
        if (sub === 'del')    return cmdContactDelete(sock, msg, from, args.slice(1));
        if (sub === 'export') return cmdContactExport(sock, msg, from);
        if (sub === 'autog')  return cmdContactAutoGroup(sock, msg, from, args.slice(1));
        return cmdContactHelp(sock, msg, from);
      }
    }
  } catch (e) { throw e; }

  if (!isGroup) return;

  try {
    switch (command) {
      case 'info':           return cmdInfo(sock, msg, from);
      case 'tagall':         return cmdTagAll(sock, msg, from);
      case 'kick':           return cmdKick(sock, msg, from);
      case 'promote':        return cmdPromote(sock, msg, from);
      case 'demote':         return cmdDemote(sock, msg, from);
      case 'subject':        return cmdSubject(sock, msg, from, args);
      case 'link':           return cmdLink(sock, msg, from);
      case 'antilink':       return cmdAntilink(sock, msg, from, args);
      case 'active':         return cmdActive(sock, msg, from, args);
      case 'inactive':       return cmdInactive(sock, msg, from, args);
      case 'resetactivity':  return cmdResetActivity(sock, msg, from);
      case 'reactions':      return cmdReactions(sock, msg, from, args);
      case 'reacted':        return cmdReacted(sock, msg, from, args);
      case 'notreacted':     return cmdNotReacted(sock, msg, from, args);
      case 'reactionstats':  return cmdReactionStats(sock, msg, from, args);
      case 'clearreactions': return cmdClearReactions(sock, msg, from);
      case 'dk':
      case 'domainking':     return cmdDk(sock, msg, from, args);
    }
  } catch (e) { throw e; }
}

// ============================================================
//  GLOBAL CRASH GUARDS
// ============================================================
process.on('uncaughtException', (e) => console.error('🔥 uncaughtException:', e?.message || e));
process.on('unhandledRejection', (e) => console.error('🔥 unhandledRejection:', e?.message || e));

startBot();
