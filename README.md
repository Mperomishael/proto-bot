# EMPIRE BOT-WAN (PROTOTYPE)

A WhatsApp automation bot powered by Baileys + Node.js, optimised for Termux on Android.

**Owner:** +2348142656848 | **Prefix:** `.` | **Version:** 1.0.0

---

## Termux Quick Start

    pkg update && pkg upgrade -y
    pkg install nodejs git -y
    git clone https://github.com/Mperomishael/proto-bot.git
    cd proto-bot
    npm install
    npm start

On first run the bot prints a **pairing code** in your terminal.
In WhatsApp go to **Linked Devices → Link with phone number** and enter the code.

---

## Configuration

Edit `configure.js` **or** set env vars in `.env` (env vars override defaults):

| Variable | Default | Notes |
|---|---|---|
| `OWNER_NUMBER` | `2348142656848` | Digits only — no + sign |
| `PREFIX` | `.` | Command trigger |
| `BOT_NAME` | `EMPIRE BOT-WAN V2` | Display name |
| `BOT_PRIVATE` | `true` | Owner-only commands |
| `SESSION_ID` | *(empty)* | Paste to skip re-pairing |
| `TIMEZONE` | `Africa/Lagos` | For timestamps |

---

## Commands (prefix `.`)

| Category | Commands |
|---|---|
| **General** | `ping` `help` `menu` `dp` |
| **Group** | `info` `tagall` `kick` `promote` `demote` `link` `subject` |
| **Antilink** | `antilink on/off` |
| **Activity** | `active` `inactive` `resetactivity` |
| **Reactions** | `reactions` `reacted` `notreacted` `reactionstats` `clearreactions` |
| **Media** | `vv` `send` *(reply `#` to quoted media to steal it)* |
| **Domain King** | `dk on/off/mode` |
| **Contacts** | `contact list/search/save/export` |
| **AI Chat** | `chat on/off` |
| **Admin** | `reboot` `update` `broadcast` `bank` `bnk` `pair` |

---

## Features

- Pairing-code login — no QR scan needed in Termux
- **Domain King** — detects and removes rival bots
- **Antilink shield** — 3-strike warning then auto-kick
- Activity + reaction tracker
- Auto-save contacts
- Auto status react (💚)
- AI reply mode (mention or reply to bot)
- Web dashboard on port `3000`

---

## Keep Alive in Termux

    termux-wake-lock
    nohup npm start > bot.log 2>&1 &
    tail -f bot.log

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Commands silently ignored | `OWNER_NUMBER` must be digits only — remove any `+` |
| Pairing code fails | Delete `auth_info/` folder and restart |
| `Cannot find module` error | Run `npm install` again |
| Session expired / logged out | Delete `auth_info/` folder and restart |

---

ISC License © 2026 **Empire Digitals**
