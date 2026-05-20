import { default as makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import pino from 'pino';

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
  });

  // Connection events: QR + reconnect
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📱 Scan this QR with WhatsApp → Linked Devices:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log('✅ Bot is online!');
    }

    if (connection === 'close') {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      console.log('❌ Disconnected. Reconnecting:', shouldReconnect);
      if (shouldReconnect) startBot();
    }
  });

  // Save credentials whenever they change
  sock.ev.on('creds.update', saveCreds);

  // Handle incoming messages and statuses
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const from = msg.key.remoteJid;
      const isStatus = from === 'status@broadcast';
      const isGroup = from?.endsWith('@g.us');
      const sender = msg.key.participant || from;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        '';

      // --- STATUS UPDATES ---
      if (isStatus) {
        const type = Object.keys(msg.message)[0];
        const caption =
          msg.message.conversation ||
          msg.message.imageMessage?.caption ||
          msg.message.videoMessage?.caption ||
          '(no text)';
        console.log(`📸 [STATUS] ${sender} posted ${type} → "${caption}"`);

        try {
          await sock.readMessages([msg.key]);
        } catch (e) {
          console.error('Could not mark status as read:', e.message);
        }
        continue;
      }

      console.log(`💬 ${isGroup ? 'GROUP' : 'DM'} ${sender}: ${text}`);

      // --- COMMANDS ---
      if (!text.startsWith('!')) continue;
      const [cmd, ...args] = text.slice(1).trim().split(/\s+/);

      if (cmd.toLowerCase() === 'ping') {
        await sock.sendMessage(from, { text: 'pong 🏓' });
      }

      // --- GROUP COMMANDS (bot must be admin) ---
      if (isGroup) {
        try {
          const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];

          if (cmd.toLowerCase() === 'info') {
            const meta = await sock.groupMetadata(from);
            const admins = meta.participants.filter(p => p.admin).length;
            const reply =
              `📋 *${meta.subject}*\n` +
              `👥 Members: ${meta.participants.length}\n` +
              `👑 Admins: ${admins}\n` +
              `📝 ${meta.desc || '(no description)'}`;
            await sock.sendMessage(from, { text: reply });
          }

          if (cmd.toLowerCase() === 'tagall') {
            const meta = await sock.groupMetadata(from);
            const mentions = meta.participants.map(p => p.id);
            const tagText = '📢 ' + meta.participants.map(p => `@${p.id.split('@')[0]}`).join(' ');
            await sock.sendMessage(from, { text: tagText, mentions });
          }

          if (cmd.toLowerCase() === 'kick' && mentioned.length) {
            await sock.groupParticipantsUpdate(from, mentioned, 'remove');
            await sock.sendMessage(from, { text: `Removed ${mentioned.length} member(s).` });
          }

          if (cmd.toLowerCase() === 'promote' && mentioned.length) {
            await sock.groupParticipantsUpdate(from, mentioned, 'promote');
            await sock.sendMessage(from, { text: `Promoted ${mentioned.length} member(s) to admin.` });
          }

          if (cmd.toLowerCase() === 'demote' && mentioned.length) {
            await sock.groupParticipantsUpdate(from, mentioned, 'demote');
            await sock.sendMessage(from, { text: `Demoted ${mentioned.length} admin(s).` });
          }

          if (cmd.toLowerCase() === 'subject' && args.length) {
            await sock.groupUpdateSubject(from, args.join(' '));
          }

          if (cmd.toLowerCase() === 'link') {
            const code = await sock.groupInviteCode(from);
            await sock.sendMessage(from, { text: `🔗 https://chat.whatsapp.com/${code}` });
          }
        } catch (err) {
          await sock.sendMessage(from, { text: `❌ Error: ${err.message}` });
        }
      }
    }
  });
}

startBot();
