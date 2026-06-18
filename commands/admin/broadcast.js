// commands/admin/broadcast.js — Safe Broadcast with Anti-Ban Timer
// Uses randomized delays to mimic human behavior.

export async function cmdBroadcast(sock, msg, from, args) {
  const text = args.join(' ');
  if (!text) return sock.sendMessage(from, { text: '❌ *Usage:* .broadcast [your message]' });

  // Fetch all groups the bot is part of
  const groups = Object.keys(await sock.groupFetchAllParticipating());
  const totalGroups = groups.length;
  
  await sock.sendMessage(from, { 
    text: `🚀 *Safe Broadcast Started*
👥 *Total Groups:* 
⏳ *Estimated Time:*  seconds
🛡️ *Anti-Ban:* Active (Randomized 3-7s delay)` 
  });

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < totalGroups; i++) {
    const gid = groups[i];
    
    try {
      await sock.sendMessage(gid, {
        text: `📢 *EMPIRE DIGITALS BROADCAST*
━━━━━━━━━━━━━━

━━━━━━━━━━━━━━`,
        footer: "Botwan Prototype • Empire Digitals",
        buttons: [
          { 
            buttonId: 'join_channel', 
            buttonText: { displayText: '🔗 Join Our Channel' }, 
            type: 1 
          }
        ],
        // Adding channel URL in the context info for Tap-to-Open
        contextInfo: {
          externalAdReply: {
            title: "Empire Digitals Worldwide",
            body: "Join our tech community",
            mediaType: 1,
            sourceUrl: "https://whatsapp.com/channel/0029VaI3OXiF6smuq5LxxN15", // Replace with your real ID
            thumbnailUrl: "https://i.ibb.co/HTF5Y3Zn/file-0000000068687243bb1908f0bb036bdb.png"
          }
        }
      });
      successCount++;
    } catch (e) {
      console.error(`Failed to send to :`, e.message);
      failCount++;
    }

    // 🛡️ ANTI-BAN TIMER LOGIC
    // We use a random delay between 3000ms and 7000ms
    if (i < totalGroups - 1) { // Don't wait after the very last group
      const randomDelay = Math.floor(Math.random() * (7000 - 3000 + 1) + 3000);
      const progress = Math.round(((i + 1) / totalGroups) * 100);
      
      console.log(`[Broadcast]  complete. Waiting s...`);
      
      // Optional: Update owner on progress every 5 groups
      if ((i + 1) % 5 === 0) {
        await sock.sendMessage(from, { text: `📊 *Broadcast Progress:*  ( / )` });
      }
      
      await new Promise(r => setTimeout(r, randomDelay));
    }
  }

  await sock.sendMessage(from, { 
    text: `✅ *Broadcast Complete!*
✨ *Sent:* 
❌ *Failed:* 
🛡️ *Status:* Account Secure` 
  });
}
