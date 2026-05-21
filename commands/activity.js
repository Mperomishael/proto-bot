import { activity, ACTIVITY_FILE, save, getGroupMeta } from '../utils/state.js';

export async function cmdActive(sock, msg, from, args) {
  try {
    const lim = parseInt(args[0]) || 10;
    const ga = activity[from] || {};
    const sorted = Object.entries(ga).sort((a, b) => b[1].count - a[1].count).slice(0, lim);
    if (!sorted.length) return sock.sendMessage(from, { text: 'No activity yet.' });
    const m = sorted.map(([j]) => j);
    const list = sorted.map(([j, d], i) => (i + 1) + '. @' + j.split('@')[0] + ' — ' + d.count).join('\n');
    await sock.sendMessage(from, { text: '🔥 Top ' + sorted.length + '\n\n' + list, mentions: m });
  } catch (e) {
    console.error('active error:', e.message);
    await sock.sendMessage(from, { text: '❌ ' + e.message });
  }
}

export async function cmdInactive(sock, msg, from, args) {
  try {
    const days = parseInt(args[0]) || 7;
    const cut = Date.now() - days * 86400000;
    const meta = await getGroupMeta(sock, from);
    const ga = activity[from] || {};
    const inact = meta.participants.filter(p => { const d = ga[p.id]; return !d || d.last < cut; });
    if (!inact.length) return sock.sendMessage(from, { text: 'All active in last ' + days + 'd.' });
    const m = inact.map(p => p.id);
    const list = inact.map(p => '• @' + p.id.split('@')[0]).join('\n');
    await sock.sendMessage(from, { text: '😴 Inactive ' + days + '+d (' + inact.length + ')\n\n' + list, mentions: m });
  } catch (e) {
    console.error('inactive error:', e.message);
    await sock.sendMessage(from, { text: '❌ ' + e.message });
  }
}

export async function cmdResetActivity(sock, msg, from) {
  try {
    activity[from] = {};
    save(ACTIVITY_FILE, activity);
    return sock.sendMessage(from, { text: '🧹 Cleared.' });
  } catch (e) {
    console.error('resetactivity error:', e.message);
    await sock.sendMessage(from, { text: '❌ ' + e.message });
  }
}

export function trackActivity(from, sender) {
  if (!activity[from]) activity[from] = {};
  if (!activity[from][sender]) activity[from][sender] = { count: 0, last: 0 };
  activity[from][sender].count++;
  activity[from][sender].last = Date.now();
  if (Math.random() < 0.05) save(ACTIVITY_FILE, activity);
}
