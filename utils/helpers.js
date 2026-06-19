import "dotenv/config";

export const PREFIX = process.env.PREFIX || ".";
export const OWNER_NUMBER = process.env.OWNER_NUMBER || "";
export const BOT_NAME = process.env.BOT_NAME || "EMPIRE BOT-WAN V2";

export const REACT_EMOJIS = ["⚡","🔥","💎","👑","🚀","✨","🛡️","🎯","💫","🌟"];
export const randomEmoji = () => REACT_EMOJIS[Math.floor(Math.random() * REACT_EMOJIS.length)];

export const isOwner = (jid) => {
  if (!jid) return false;
  const norm = jid.includes("@") ? jid : jid + "@s.whatsapp.net";
  return norm === OWNER_NUMBER;
};

export function getContextInfo(msg) {
  const m = msg.message || {};
  return (m.extendedTextMessage && m.extendedTextMessage.contextInfo)
      || (m.imageMessage && m.imageMessage.contextInfo)
      || (m.videoMessage && m.videoMessage.contextInfo)
      || (m.stickerMessage && m.stickerMessage.contextInfo)
      || null;
}

export function getQuotedMessage(msg) {
  const ctx = getContextInfo(msg);
  if (!ctx || !ctx.quotedMessage) return null;
  return { quoted: ctx.quotedMessage, participant: ctx.participant, stanzaId: ctx.stanzaId };
}

export function getTargets(msg) {
  const ctx = getContextInfo(msg);
  if (ctx && ctx.mentionedJid && ctx.mentionedJid.length) return ctx.mentionedJid;
  if (ctx && ctx.participant) return [ctx.participant];
  return [];
}

export function frame(title, body) {
  const top = "╭━━━〔 ✦ " + title + " ✦ 〕━━━╮";
  const bot = "╰━━━━━━━━━━━━━━━━━━━━╯";
  const lines = body.split("\n").map(function(l){ return "┃ " + l; }).join("\n");
  return top + "\n" + lines + "\n" + bot;
}

export function buildList() {
  const body = [
    "🤖 *Bot Identity*",
    "Name: " + BOT_NAME,
    "Prefix: " + PREFIX,
    "Owner: +" + OWNER_NUMBER.split("@")[0],
    "Mode: 🔒 STRICT PRIVATE",
    "",
    "📦 *Features*",
    "",
    "👑 Domain King",
    "🚫 Antilink shield",
    "📊 Activity tracker",
    "⭐ Reactions tracker",
    "📇 Auto-save contacts",
    "",
    "Type " + PREFIX + "menu for commands."
  ].join("\n");
  return frame(BOT_NAME + " - FEATURE LIST", body);
}

export function buildMenu() {
  const p = PREFIX;
  const body = [
    "📌 *General*",
    "• " + p + "ping  • " + p + "help  • " + p + "menu",
    "",
    "📇 *Contacts*",
    "• " + p + "contact list/search/save/del/export",
    "",
    "👥 *Group*",
    "• " + p + "info  • " + p + "tagall  • " + p + "link",
    "• " + p + "kick  • " + p + "promote  • " + p + "demote",
    "",
    "🚫 *Antilink*: " + p + "antilink on/off",
    "",
    "📊 *Activity*",
    "• " + p + "active  • " + p + "inactive  • " + p + "resetactivity",
    "",
    "⭐ *Reactions*",
    "• " + p + "reactions  • " + p + "reacted  • " + p + "notreacted",
    "• " + p + "reactionstats  • " + p + "clearreactions",
    "",
    "👑 *DK*: " + p + "dk on/off/mode",
    "",
    "🕵️ *Media*: " + p + "vv  • " + p + "send",
    "",
    "⚙️ *Admin*",
    "• " + p + "reboot  • " + p + "update  • " + p + "broadcast",
    "• " + p + "bank  • " + p + "bnk  • " + p + "pair <number>"
  ].join("\n");
  return frame(BOT_NAME + " - COMMAND MENU", body);
}
