import { OWNER_NUMBER, isOwner, getTargets } from '../../utils/helpers.js';

export async function cmdProfile(sock, msg, from, args = []) {
  // Resolve target: 1. Reply/Mention, 2. Typed number, 3. Sender
  let target = getTargets(msg)?.[0];

  if (!target && args[0]) {
    const digits = String(args[0]).replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 15) {
      target = digits + '@s.whatsapp.net';
    }
  }

  if (!target) {
    target = msg.key.fromMe ? OWNER_NUMBER : (msg.key.participant || from);
  }

  try {
    const picUrl = await sock.profilePictureUrl(target, 'image').catch(() => 
                   sock.profilePictureUrl(target, 'preview').catch(() => null));

    const [status, onWA] = await Promise.all([
      sock.fetchStatus(target).catch(() => null),
      sock.onWhatsApp(target).catch(() => null),
    ]);

    const about = status?.status || '(hidden)';
    const name = onWA?.[0]?.notify || onWA?.[0]?.name || '(unknown)';
    const num = target.split('@')[0];

    const NL = String.fromCharCode(10);
    const txt = `👤 *PROFILE*${NL}━━━━━━━━━━━━━━━━━━${NL}📛 ${name}${NL}📱 +${num}${NL}🆔 ${target}${NL}📝 ${about}${NL}🏷 Owner: ${isOwner(target) ? '✅' : '❌'}`;

    if (picUrl) {
      await sock.sendMessage(from, { image: { url: picUrl }, caption: txt, mentions: [target] }, { quoted: msg });
    } else {
      await sock.sendMessage(from, { text: txt + `${NL}${NL}_(No profile picture visible)_`, mentions: [target] }, { quoted: msg });
    }
  } catch (e) {
    console.error('profile error:', e.message);
    await sock.sendMessage(from, { text: '❌ Error: ' + e.message });
  }
}
