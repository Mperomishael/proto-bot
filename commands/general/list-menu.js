import { buildList, buildMenu } from '../../utils/helpers.js';

export async function cmdList(sock, msg, from) {
  await sock.sendMessage(from, { text: buildList() });
}

export async function cmdMenu(sock, msg, from) {
  await sock.sendMessage(from, { text: buildMenu() });
}
