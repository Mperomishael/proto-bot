import { OWNER_NUMBER, isOwner, getTargets } from '../../utils/helpers.js';


export async function cmdProfile(sock, msg, from, args = []) {
  // 1. Reply or @mention via getTargets
  let target = getTargets(msg)?.[0];

  // 2. Typed number, e.g. ".dp 2348012345678"
  if (!target && args[0]) {
    const digits = String(args[0]).replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 15) {
      target = digits + '@s.whatsapp.net';
    }
  }

  // 3. Fallback to sender (so .dp alone shows your own)
  if (!target) {
    target = msg.key.fromMe ? OWNER_NUMBER : (msg.key.participant || from);
  }

  try {
    let picBuffer = null;
    try {
      picBuffer = await sock.profilePictureUrl(target, 'image')
        .then(url => fetch(url, { headers: { 'User-Agent': 'WhatsApp/2.23.0' } }))
        .then(res => res.arrayBuffer())
        .then(ab => Buffer.from(ab))
        .catch(() => null);
    } catch (e) {
      console.error('pic download attempt:', e.message);
    }

    const [status, onWA] = await Promise.all([
      sock.fetchStatus(target).catch(() => null),
      sock.onWhatsApp(target).catch(() => null),
    ]);

    let about = '(hidden)';
    if (status) about = status?.status?.status || status?.status || status?.[0]?.status?.status || '(none)';
    if (typeof about !== 'string') about = '(none)';

    const name = onWA?.[0]?.notify || onWA?.[0]?.name || '(unknown)';
    const num = target.split('@')[0];

    const NL = String.fromCharCode(10);
    const txt =
      '👤 *PROFILE*' + NL +
      '━━━━━━━━━━━━━━━━━━' + NL +
      '📛 ' + name + NL +
      '📱 +' + num + NL +
      '🆔 ' + target + NL +
      '📝 ' + about + NL +
      '🖼 ' + (picBuffer ? 'Photo' : 'hidden') + NL +
      '🏷 Owner: ' + (isOwner(target) ? '✅' : '❌');

    if (picBuffer && picBuffer.length > 0) {
      await sock.sendMessage(OWNER_NUMBER, { image: picBuffer, caption: txt, mentions: [target] });
    } else {
      await sock.sendMessage(OWNER_NUMBER, { text: txt, mentions: [target] });
    }
    await sock.sendMessage(from, { text: '✅ Profile sent to your DM.' });

  } catch (e) {
    console.error('profile cmd error:', e.message);
    await sock.sendMessage(from, { text: '❌ Error fetching profile: ' + e.message });
  }
}
