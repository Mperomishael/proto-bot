import fs from 'fs';

// ── file constants ─────────────────────────────────────────
export const REACTIONS_FILE   = 'reactions.json';
export const ACTIVITY_FILE    = 'activity.json';
export const ANTILINK_FILE    = 'antilink.json';
export const STATUS_LOG_FILE  = 'status_log.json';
export const DOMAIN_KING_FILE = 'domainking.json';

// ── helpers ────────────────────────────────────────────────
function loadJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}
export function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ── state objects ──────────────────────────────────────────
export const reactions      = loadJSON(REACTIONS_FILE,   {});
export const activity       = loadJSON(ACTIVITY_FILE,    {});
export const antilink       = loadJSON(ANTILINK_FILE,    {});
export const antilinkGroups = antilink;
export const domainKing     = loadJSON(DOMAIN_KING_FILE, {});
export const statusLog      = loadJSON(STATUS_LOG_FILE,  []);

export function logStatus(entry) {
  statusLog.push({ ...entry, ts: new Date().toISOString() });
  save(STATUS_LOG_FILE, statusLog);
}

// ── group metadata cache ───────────────────────────────────
const _gc = new Map();
export function invalidateGroup(id) { _gc.delete(id); }
export async function getCachedGroup(sock, id) {
  if (!_gc.has(id)) _gc.set(id, await sock.groupMetadata(id));
  return _gc.get(id);
}
export const getGroupMeta = getCachedGroup;
