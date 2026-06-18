import fs from 'fs';
const BANK_FILE = './data/bank.json';

if (!fs.existsSync('./data')) fs.mkdirSync('./data');
if (!fs.existsSync(BANK_FILE)) fs.writeFileSync(BANK_FILE, JSON.stringify({}));

export async function cmdBankSettings(sock, msg, from, args) {
  const [bankName, accNum, accName] = args.join(' ').split('|').map(s => s.trim());
  if (!bankName || !accNum || !accName) {
    return sock.sendMessage(from, { text: '❌ *Usage:* .bnk Bank Name | Account Number | Account Name' });
  }

  const data = JSON.parse(fs.readFileSync(BANK_FILE));
  data[from] = { bankName, accNum, accName };
  fs.writeFileSync(BANK_FILE, JSON.stringify(data));

  await sock.sendMessage(from, { text: '✅ *Bank details saved successfully!*' });
}

export async function cmdShowBank(sock, msg, from) {
  const data = JSON.parse(fs.readFileSync(BANK_FILE));
  const bank = data[from];

  if (!bank) return sock.sendMessage(from, { text: '❌ No bank details found. Use `.bnk` to set them up.' });

  const sections = [{
    title: "Bank Details",
    rows: [{ title: "Copy Account Number", rowId: `copy_acc_${bank.accNum}`, description: bank.accNum }]
  }];

  const message = {
    text: `🏦 *BANK DETAILS*
━━━━━━━━━━━━━━
🏛 *Bank:* ${bank.bankName}
🔢 *Number:* ${bank.accNum}
👤 *Name:* ${bank.accName}
━━━━━━━━━━━━━━
_Tap the button below to copy the number._`,
    footer: "Botwan Prototype • Empire Digitals",
    buttons: [
      { buttonId: 'copy_acc', buttonText: { displayText: `Copy: ${bank.accNum}` }, type: 1 }
    ],
    headerType: 1
  };

  await sock.sendMessage(from, message);
}
