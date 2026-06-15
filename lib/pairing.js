// lib/pairing.js — Pairing code generator for the bot's first launch.
// Prints an 8-digit code to terminal/deploy logs.
// User enters it in WhatsApp → Linked Devices → Link with phone number instead.
//
// NOTE: This module relies on the main socket in index.js being created with
//   browser: Browsers.macOS('Safari')
// for the generated code to be accepted by WhatsApp's 2026 pairing endpoint.

export async function setupPairing(sock, ownerNumber) {
  // If already authenticated, do nothing — never re-pair on every restart
  if (sock.authState.creds.registered) return;

  // Strip @s.whatsapp.net, +, spaces, dashes — Baileys wants pure digits
  const phone = String(ownerNumber).replace(/[^\d]/g, '');
  if (!phone || phone.length < 8 || phone.length > 15) {
    console.error('❌ Invalid phone number for pairing:', ownerNumber);
    return;
  }

  // Wait for the Noise handshake to fully settle before requesting code.
  // The bot's main socket carries more state than the portal's child sockets,
  // so we use a slightly longer delay (5s vs the portal's 4.5s).
  await new Promise(r => setTimeout(r, 5000));

  // Guard: confirm the socket actually initialized auth state
  if (!sock.authState?.creds) {
    console.error('❌ Auth state failed to initialize — cannot generate pairing code.');
    console.error('   Try deleting auth_info/ and restarting.');
    return;
  }

  let code;
  try {
    code = await sock.requestPairingCode(phone);
  } catch (e) {
    console.error('❌ Pairing code generation failed:', e.message);
    console.error('   Falling back to QR code — scan it instead.');
    return;
  }

  const formatted = code.match(/.{1,4}/g)?.join('-') || code;

  const NL = String.fromCharCode(10);
  console.log(NL + '╭━━━━━━━━━━━━━━━━━━━━━━━━━━╮');
  console.log('┃   🔗 PAIRING CODE READY     ┃');
  console.log('┃                              ┃');
  console.log('┃   👉  ' + formatted.padEnd(20) + '┃');
  console.log('┃                              ┃');
  console.log('╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯' + NL);
  console.log('📱 On your phone:');
  console.log('   1. Open WhatsApp');
  console.log('   2. Settings → Linked Devices');
  console.log('   3. Link a Device');
  console.log('   4. Tap "Link with phone number instead"');
  console.log('   5. Enter the 8 characters above (ignore the dash)');
  console.log('   ⏱  Code expires in ~60 seconds — be quick!' + NL);
  console.log('   📞 Pairing for: +' + phone);
  console.log('   🌐 Browser fingerprint: macOS Safari (set in index.js)' + NL);
}
