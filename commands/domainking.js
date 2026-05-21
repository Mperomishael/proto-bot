import { domainKing, DOMAIN_KING_FILE, save } from '../utils/state.js';
import { getTargets } from '../utils/helpers.js';

export async function cmdDk(sock, msg, from, args) {
  try {
    const sub = (args[0] || '').toLowerCase();
    if (!domainKing[from]) domainKing[from] = { enabled: false, action: 'warn', arrested: {} };
    
    if (sub === 'on') {
      domainKing[from].enabled = true;
      save(DOMAIN_KING_FILE, domainKing);
      return sock.sendMessage(from, { text: '👑 ACTIVE. Mode: ' + domainKing[from].action });
    }
    
    if (sub === 'off') {
      domainKing[from].enabled = false;
      save(DOMAIN_KING_FILE, domainKing);
      return sock.sendMessage(from, { text: '👑 OFF.' });
    }
    
    if (sub === 'mode' && args[1] && ['warn', 'kick'].includes(args[1].toLowerCase())) {
      domainKing[from].action = args[1].toLowerCase();
      save(DOMAIN_KING_FILE, domainKing);
      return sock.sendMessage(from, { text: '⚖️ Mode: ' + domainKing[from].action });
    }
    
    if (sub === 'arrested') {
      const e = Object.entries(domainKing[from].arrested || {});
      if (!e.length) return sock.sendMessage(from, { text: '📜 No arrests.' });
      const m = e.map(([j]) => j);
      return sock.sendMessage(from, { text: '🚔 Arrests\n\n' + e.map(([j, d]) => '• @' + j.split('@')[0] + ' — ' + d.strikes).join('\n'), mentions: m });
    }
    
    if (sub === 'pardon') {
      const t = getTargets(msg);
      if (!t.length) return sock.sendMessage(from, { text: '↩️ Reply or mention.' });
      for (const x of t) delete domainKing[from].arrested?.[x];
      save(DOMAIN_KING_FILE, domainKing);
      return sock.sendMessage(from, { text: '🕊️ Pardoned ' + t.length, mentions: t });
    }
    
    const c = Object.keys(domainKing[from].arrested || {}).length;
    return sock.sendMessage(from, { text: '👑 *DK*\nState: ' + (domainKing[from].enabled ? '🟢' : '🔴') + '\nMode: ' + domainKing[from].action + '\nArrested: ' + c });
  } catch (e) {
    console.error('dk error:', e.message);
    await sock.sendMessage(from, { text: '❌ ' + e.message });
  }
}
