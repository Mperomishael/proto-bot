import { PREFIX } from '../../utils/helpers.js';

export async function cmdPing(sock, msg, from) {
  const t0 = Date.now();
  await sock.sendMessage(from, { text: 'pong 🏓 ' + (Date.now() - t0) + 'ms' });
}

export async function cmdHelp(sock, msg, from) {
  await sock.sendMessage(from, { text: 'Try *' + PREFIX + 'menu* or *' + PREFIX + 'list*' });
}
