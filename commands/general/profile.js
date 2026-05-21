import { OWNER_NUMBER, isOwner, getTargets } from '../../utils/helpers.js';

export async function cmdProfile(sock, msg, from) {
  const targets = getTargets(msg);
  const sender = msg.key.fromMe ? OWNER_NUMBER : (msg.key.participant || from);
  const target = targets[0] || sender;
  
  try {
    // Download profile picture directly as buffer
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
    
    // Get user info
    const [status, onWA] = await Promise.all([
      sock.fetchStatus(target).catch(() => null),
      sock.onWhatsApp(target).catch(() => null),
    ]);
    
    let about = '(hidden)';
    if (status) about = status?.status?.status || status?.status || status?.[0]?.status?.status || '(none)';
    if (typeof about !== 'string') about = '(none)';
    
    const name = onWA?.[0]?.notify || onWA?.[0]?.name || '(unknown)';
    const num = target.split('@')[0];
    
    const txt =
'👤 *PROFILE*\n━━━━━━━━━━━━━━━━━━\n' +
'📛 ' + name + '\n📱 +' + num + '\n🆔 ' + target + '\n📝 ' + about + '\n' +
'🖼 ' + (picBuffer ? 'Photo' : 'hidden') + '\n🏷 Owner: ' + (isOwner(target) ? '✅' : '❌');
    
    // Send with picture first
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
