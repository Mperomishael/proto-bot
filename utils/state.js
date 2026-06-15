import fs from 'fs';

// ====== FILES ======
export const ANTILINK_FILE = './antilink.json';
export const ACTIVITY_FILE = './activity.json';
export const DOMAIN_KING_FILE = './domainking.json';
export const STATUS_LOG_FILE = './statuslog.json';
export const REACTIONS_FILE = './reactions.json';

// ====== STATE ======
const load = (f, fallback) => { 
  try { 
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : fallback; 
  } catch { 
    return fallback; 
  } 
};

export let antilinkGroups = load(ANTILINK_FILE, {});
export let activity       = load(ACTIVITY_FILE, {});
export let domainKing     = load(DOMAIN_KING_FILE, {});
export let statusLog      = load(STATUS_LOG_FILE, {});
export let reactions      = load(REACTIONS_FILE, {});

export const save = (f, d) => { 
  try { 
    fs.writeFileSync(f, JSON.stringify(d, null, 2)); 
  } catch (e) { 
    console.error('save fail', f, e.message); 
  } 
};

// Update state from exports
export function reloadState() {
  antilinkGroups = load(ANTILINK_FILE, {});
  activity       = load(ACTIVITY_FILE, {});
  domainKing     = load(DOMAIN_KING_FILE, {});
  statusLog      = load(STATUS_LOG_FILE, {});
  reactions      = load(REACTIONS_FILE, {});
}

// ====== METADATA CACHE ======
export const groupMetaCache = new Map();
export const META_TTL = 5 * 60 * 1000;

export async function getGroupMeta(sock, jid) {
  const c = groupMetaCache.get(jid);
  if (c && c.expires > Date.now()) return c.data;
  const data = await sock.groupMetadata(jid);
  groupMetaCache.set(jid, { data, expires: Date.now() + META_TTL });
  return data;
}

export const invalidateGroup = (jid) => groupMetaCache.delete(jid);
