import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

export async function cmdUpdate(sock, msg, from) {
  await sock.sendMessage(from, { text: '⏳ *Checking for updates...*' });

  try {
    // 1. Git Pull
    const { stdout: pullOut } = await execAsync('git pull');
    
    if (pullOut.includes('Already up to date')) {
      return await sock.sendMessage(from, { text: '✅ *Bot is already up to date.*' });
    }

    await sock.sendMessage(from, { text: '📥 *Updates found!* Installing dependencies...' });

    // 2. Install any new npm packages added to package.json
    await execAsync('npm install');

    await sock.sendMessage(from, { 
      text: '✅ *Update successful!* Restarting bot to apply changes...' 
    });

    // 3. Trigger reboot
    setTimeout(() => process.exit(0), 2000);

  } catch (e) {
    console.error('Update error:', e);
    await sock.sendMessage(from, { text: '❌ *Update failed:* ' + e.message });
  }
}

export async function cmdReboot(sock, msg, from) {
  await sock.sendMessage(from, { text: '🔄 *Rebooting system...* Please wait.' });
  
  // Exit the process. PM2 will catch this and restart the bot automatically.
  setTimeout(() => process.exit(0), 1000);
}
