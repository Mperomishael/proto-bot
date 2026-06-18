export async function cmdBroadcast(sock, msg, from, args) {
  const text = args.join(' ');
  if (!text) return sock.sendMessage(from, { text: '❌ Please provide a message to broadcast.' });

  const groups = Object.keys(await sock.groupFetchAllParticipating());
  await sock.sendMessage(from, { text: `🚀 *Broadcasting to ${groups.length} groups...*` });

  for (const gid of groups) {
    await sock.sendMessage(gid, {
      text: `📢 *EMPIRE BROADCAST*
━━━━━━━━━━━━━━
${text}
━━━━━━━━━━━━━━`,
      footer: "Join our community below",
      buttons: [
        { buttonId: 'join_channel', buttonText: { displayText: '🔗 Join Channel' }, type: 1, nativeFlowInfo: { 
          name: "quick_reply", 
          paramsJson: JSON.stringify({ display_text: "Join Channel", id: "https://whatsapp.com/channel/0029VaI3OXiF6smuq5LxxN15" }) 
        }}
      ]
    });
    await new Promise(r => setTimeout(r, 2000)); // Prevent ban
  }
}
