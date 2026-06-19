import fs   from 'fs';
import path from 'path';

export const REACTIONS_FILE  = 'reactions.json';
export const ACTIVITY_FILE   = 'activity.json';
export const ANTILINK_FILE   = 'antilink.json';

function loadJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

export const reactions = loadJSON(REACTIONS_FILE, {});
export const activity  = loadJSON(ACTIVITY_FILE,  {});
export const antilink  = loadJSON(ANTILINK_FILE,  {});

export function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const groupCache = new Map();
export function invalidateGroup(id) { groupCache.delete(id); }
export async function getCachedGroup(sock, id) {
  if (!groupCache.has(id)) groupCache.set(id, await sock.groupMetadata(id));
  return groupCache.get(id);
}
