import { OWNER_NUMBER } from '../utils/helpers.js';
import { reactions, REACTIONS_FILE, save, getGroupMeta } from '../utils/state.js';

/**
 * Get today's date string (YYYY-MM-DD)
 */
function getTodayString() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/**
 * Get date string from timestamp
 */
function getDateString(timestamp) {
  const d = new Date(timestamp);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/**
 * Track reactions to messages
 * Stores who reacted to admin messages
 */
export async function trackReactions(reactions_data, from, msg, sender) {
  if (!msg?.key?.id) return;
  
  // Only track reactions in groups
  if (!from.endsWith('@g.us')) return;
  
  // Initialize group reactions object
  if (!reactions_data[from]) {
    reactions_data[from] = {};
  }
  
  const messageId = msg.key.id;
  const today = getTodayString();
  
  if (!reactions_data[from][messageId]) {
    reactions_data[from][messageId] = {
      from: sender,
      timestamp: msg.messageTimestamp || Date.now(),
      date: today,
      reactions: {}
    };
  }
}

/**
 * Handle message reaction updates
 * Baileys emits reactions via messages.update event
 */
export function handleReactionUpdate(reactions_data, update) {
  if (!update?.key?.remoteJid) {
    return;
  }
  
  const { remoteJid, id, participant, fromMe } = update.key;
  
  // Only track in groups
  if (!remoteJid.endsWith('@g.us')) {
    return;
  }
  
  // Check for reaction message
  if (!update?.message?.reactionMessage) {
    return;
  }
  
  const { reactionMessage } = update.message;
  
  // Ensure we have the key for the original message being reacted to
  if (!reactionMessage.key?.id) {
    console.log('⚠️ Reaction missing original message key');
    return;
  }
  
  if (!reactions_data[remoteJid]) {
    reactions_data[remoteJid] = {};
  }
  
  const msgId = reactionMessage.key.id;
  const today = getTodayString();
  
  // Initialize message if not exists
  if (!reactions_data[remoteJid][msgId]) {
    reactions_data[remoteJid][msgId] = {
      from: 'unknown',
      timestamp: Date.now(),
      date: today,
      reactions: {}
    };
  }
  
  // Get reactor JID (person who reacted)
  const reactorJid = participant || remoteJid;
  const emoji = reactionMessage.text || '👍';
  
  console.log('✅ REACTION: +' + reactorJid.split('@')[0] + ' reacted with ' + emoji + ' to msg ' + msgId.slice(0, 8));
  
  // Store reactions array for this person
  if (!reactions_data[remoteJid][msgId].reactions[reactorJid]) {
    reactions_data[remoteJid][msgId].reactions[reactorJid] = [];
  }
  
  // Add reaction with timestamp
  reactions_data[remoteJid][msgId].reactions[reactorJid].push({
    emoji,
    timestamp: Date.now()
  });
}

/**
 * Display reactions to admin's messages
 * Command: !reactions [limit] or !reactions today
 * Shows: Who reacted with which emoji
 */
export async function cmdReactions(sock, msg, from, args) {
  try {
    const limit = parseInt(args[0]) || 10;
    const filterToday = (args[0] || '').toLowerCase() === 'today';
    
    if (!from.endsWith('@g.us')) {
      return sock.sendMessage(from, { text: '⚠️ This command works only in groups.' });
    }
    
    const groupReactions = reactions[from] || {};
    const today = getTodayString();
    
    // Filter messages from ADMIN (using isAdmin flag)
    let adminMessages = Object.entries(groupReactions)
      .filter(([_, data]) => data.isAdmin === true);
    
    // Filter by today if requested
    if (filterToday) {
      adminMessages = adminMessages.filter(([_, data]) => data.date === today);
    }
    
    adminMessages = adminMessages
      .sort((a, b) => b[1].timestamp - a[1].timestamp)
      .slice(0, limit);
    
    if (!adminMessages.length) {
      return sock.sendMessage(from, { text: '📊 No reactions tracked yet or no admin messages found.' });
    }
    
    let text = '📊 **Emoji Reactions To Your Messages**\n';
    if (filterToday) text += '(Today Only)\n';
    text += '\n';
    
    for (const [msgId, data] of adminMessages) {
      const reactors = Object.entries(data.reactions);
      
      if (reactors.length === 0) continue;
      
      text += '━━━━━━━━━━━━━━━━━━\n';
      text += 'Reactions: ' + reactors.length + ' person(s)\n\n';
      
      // Show each person's emoji reactions
      for (const [reactor, reactions_list] of reactors) {
        const number = reactor.split('@')[0];
        text += '👤 +' + number + '\n';
        
        // Count emojis per person
        const emojiCount = {};
        for (const reaction of reactions_list) {
          const emoji = reaction.emoji;
          emojiCount[emoji] = (emojiCount[emoji] || 0) + 1;
        }
        
        // Show emoji breakdown
        for (const [emoji, count] of Object.entries(emojiCount)) {
          text += '   ' + emoji + ' ×' + count + '\n';
        }
        
        text += '\n';
      }
    }
    
    await sock.sendMessage(from, { text });
    
  } catch (e) {
    console.error('reactions cmd error:', e.message);
    await sock.sendMessage(from, { text: '❌ ' + e.message });
  }
}

/**
 * Show who reacted to admin messages with their phone numbers and reaction counts
 * Command: !reacted [date] - default today
 * Shows: Name, Number, Emoji reactions count
 */
export async function cmdReacted(sock, msg, from, args) {
  try {
    if (!from.endsWith('@g.us')) {
      return sock.sendMessage(from, { text: '⚠️ This command works only in groups.' });
    }
    
    const filterDate = args[0] || getTodayString();
    const groupReactions = reactions[from] || {};
    const meta = await sock.groupMetadata(from);
    
    // Get member names
    const memberMap = {};
    for (const p of meta.participants) {
      memberMap[p.id] = p.id.split('@')[0];
    }
    
    // Filter messages from ADMIN for the date (using isAdmin flag)
    const adminMessages = Object.entries(groupReactions)
      .filter(([_, data]) => data.isAdmin === true && data.date === filterDate);
    
    if (!adminMessages.length) {
      return sock.sendMessage(from, { text: '📊 No admin messages for ' + filterDate });
    }
    
    // Collect reactors with their emoji counts
    const reactorStats = {};
    for (const [_, data] of adminMessages) {
      for (const [reactor, reactions_list] of Object.entries(data.reactions)) {
        if (!reactorStats[reactor]) {
          reactorStats[reactor] = {
            jid: reactor,
            number: reactor.split('@')[0],
            emojis: {},
            total: 0
          };
        }
        
        // Count each emoji
        for (const reaction of reactions_list) {
          const emoji = reaction.emoji;
          reactorStats[reactor].emojis[emoji] = (reactorStats[reactor].emojis[emoji] || 0) + 1;
          reactorStats[reactor].total++;
        }
      }
    }
    
    if (Object.keys(reactorStats).length === 0) {
      return sock.sendMessage(from, { text: '😢 Nobody reacted yet on ' + filterDate });
    }
    
    // Sort by total reactions descending
    const sorted = Object.values(reactorStats)
      .sort((a, b) => b.total - a.total);
    
    let text = '✅ **People Who Reacted** (' + filterDate + ')\n\n';
    
    for (const stats of sorted) {
      text += '+' + stats.number + '\n';
      
      // Show emoji breakdown
      for (const [emoji, count] of Object.entries(stats.emojis)) {
        text += '  ' + emoji + ' ×' + count + '\n';
      }
      
      text += '  _Total: ' + stats.total + ' reaction(s)_\n\n';
    }
    
    text += '━━━━━━━━━━━━━━\n';
    text += '_Total People: ' + sorted.length + '_';
    
    await sock.sendMessage(from, { text });
    
  } catch (e) {
    console.error('reacted cmd error:', e.message);
    await sock.sendMessage(from, { text: '❌ ' + e.message });
  }
}

/**
 * Show who did NOT react to admin messages with their phone numbers
 * Command: !notreacted [date] - default today
 */
export async function cmdNotReacted(sock, msg, from, args) {
  try {
    if (!from.endsWith('@g.us')) {
      return sock.sendMessage(from, { text: '⚠️ This command works only in groups.' });
    }
    
    const filterDate = args[0] || getTodayString();
    const groupReactions = reactions[from] || {};
    const meta = await sock.groupMetadata(from);
    
    // Get all participants (exclude bots and admins usually)
    const allMembers = new Set();
    for (const p of meta.participants) {
      allMembers.add(p.id);
    }
    
    // Filter messages from ADMIN for the date (using isAdmin flag)
    const adminMessages = Object.entries(groupReactions)
      .filter(([_, data]) => data.isAdmin === true && data.date === filterDate);
    
    if (!adminMessages.length) {
      return sock.sendMessage(from, { text: '📊 No admin messages for ' + filterDate });
    }
    
    // Collect all unique reactors
    const reactedSet = new Set();
    for (const [_, data] of adminMessages) {
      for (const reactor of Object.keys(data.reactions)) {
        reactedSet.add(reactor);
      }
    }
    
    // Find who didn't react
    const notReactedSet = new Set();
    for (const member of allMembers) {
      if (!reactedSet.has(member)) {
        notReactedSet.add(member);
      }
    }
    
    if (notReactedSet.size === 0) {
      return sock.sendMessage(from, { text: '🎉 Everyone reacted to your messages on ' + filterDate });
    }
    
    let text = '❌ **People Who Did NOT React** (' + filterDate + ')\n\n';
    let count = 1;
    for (const jid of Array.from(notReactedSet).sort()) {
      const num = jid.split('@')[0];
      text += count + '. +' + num + '\n';
      count++;
    }
    
    text += '\n_Total: ' + notReactedSet.size + ' person(s)_';
    
    await sock.sendMessage(from, { text });
    
  } catch (e) {
    console.error('not reacted cmd error:', e.message);
    await sock.sendMessage(from, { text: '❌ ' + e.message });
  }
}

/**
 * Get detailed reactions for admin messages
 * Command: !reactionstats [date]
 * Shows: stats, emoji breakdown, who reacted most
 */
export async function cmdReactionStats(sock, msg, from, args) {
  try {
    if (!from.endsWith('@g.us')) {
      return sock.sendMessage(from, { text: '⚠️ This command works only in groups.' });
    }
    
    const filterDate = args[0] || getTodayString();
    const groupReactions = reactions[from] || {};
    
    // Filter messages from ADMIN for the date (using isAdmin flag)
    const adminMessages = Object.entries(groupReactions)
      .filter(([_, data]) => data.isAdmin === true && data.date === filterDate);
    
    if (!adminMessages.length) {
      return sock.sendMessage(from, { text: '📊 No reactions tracked for ' + filterDate });
    }
    
    // Collect stats
    const reactorStats = {};
    const emojiStats = {};
    let totalReactions = 0;
    
    for (const [_, data] of adminMessages) {
      for (const [reactor, reactions_list] of Object.entries(data.reactions)) {
        if (!reactorStats[reactor]) {
          reactorStats[reactor] = {
            number: reactor.split('@')[0],
            total: 0
          };
        }
        
        for (const reaction of reactions_list) {
          const emoji = reaction.emoji;
          emojiStats[emoji] = (emojiStats[emoji] || 0) + 1;
          reactorStats[reactor].total++;
          totalReactions++;
        }
      }
    }
    
    const peopleReacted = Object.keys(reactorStats).length;
    
    // Sort reactors by total reactions
    const topReactors = Object.entries(reactorStats)
      .map(([jid, stats]) => ({ jid, ...stats }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    
    // Sort emojis by count
    const topEmojis = Object.entries(emojiStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    let text = '📈 **Reaction Statistics** (' + filterDate + ')\n\n';
    text += '━━━━━━━━━━━━━━━━━\n';
    text += '👤 Your Messages: ' + adminMessages.length + '\n';
    text += '⭐ Total Emoji Reactions: ' + totalReactions + '\n';
    text += '👥 People Who Reacted: ' + peopleReacted + '\n';
    text += '━━━━━━━━━━━━━━━━━\n\n';
    
    text += '**Top Reactions Used:**\n';
    for (const [emoji, count] of topEmojis) {
      text += emoji + ' ×' + count + '\n';
    }
    
    text += '\n**Top Reactors:**\n';
    for (let i = 0; i < topReactors.length; i++) {
      const r = topReactors[i];
      text += (i + 1) + '. +' + r.number + ' (' + r.total + ' reactions)\n';
    }
    
    await sock.sendMessage(from, { text });
    
  } catch (e) {
    console.error('reaction stats error:', e.message);
    await sock.sendMessage(from, { text: '❌ ' + e.message });
  }
}

/**
 * Clear reactions data for current group
 * Command: !clearreactions
 */
export async function cmdClearReactions(sock, msg, from) {
  try {
    if (!from.endsWith('@g.us')) {
      return sock.sendMessage(from, { text: '⚠️ This command works only in groups.' });
    }
    
    delete reactions[from];
    save(REACTIONS_FILE, reactions);
    
    return sock.sendMessage(from, { text: '🧹 Reaction data cleared.' });
  } catch (e) {
    console.error('clear reactions error:', e.message);
    await sock.sendMessage(from, { text: '❌ ' + e.message });
  }
}
