/**
 * Forward device localhost:5000 → PC localhost:5000 (USB debugging).
 * Required when EXPO_PUBLIC_API_BASE uses 127.0.0.1 on a physical Android device.
 *
 * Usage: npm run adb:api
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PORT = process.env.API_PORT || '5000';

function findAdb() {
  if (process.env.ADB_PATH && fs.existsSync(process.env.ADB_PATH)) {
    return process.env.ADB_PATH;
  }

  const home = os.homedir();
  const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  const candidates = [
    process.env.ANDROID_HOME && path.join(process.env.ANDROID_HOME, 'platform-tools', 'adb.exe'),
    process.env.ANDROID_SDK_ROOT && path.join(process.env.ANDROID_SDK_ROOT, 'platform-tools', 'adb.exe'),
    path.join(localAppData, 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
    path.join(home, 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
    path.join(home, 'Library', 'Android', 'sdk', 'platform-tools', 'adb'),
    path.join(home, 'Android', 'Sdk', 'platform-tools', 'adb'),
  ].filter(Boolean);

  return candidates.find((p) => fs.existsSync(p)) || null;
}

const adb = findAdb();
if (!adb) {
  console.error('adb not found. Install Android SDK platform-tools, or set ADB_PATH / ANDROID_HOME.');
  console.error('Typical path: %LOCALAPPDATA%\\Android\\Sdk\\platform-tools\\adb.exe');
  process.exit(1);
}

const devices = spawnSync(adb, ['devices'], { encoding: 'utf8' });
if (devices.status !== 0) {
  console.error(devices.stderr || devices.stdout || 'adb devices failed');
  process.exit(1);
}

const connected = (devices.stdout || '')
  .split(/\r?\n/)
  .slice(1)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('*') && l.includes('\tdevice'));

if (!connected.length) {
  console.error('No Android device/emulator in "device" state. Plug in USB and enable USB debugging.');
  process.exit(1);
}

const result = spawnSync(adb, ['reverse', `tcp:${PORT}`, `tcp:${PORT}`], { encoding: 'utf8' });
if (result.status !== 0) {
  console.error(result.stderr || result.stdout || 'adb reverse failed');
  process.exit(1);
}

console.log(`OK: device 127.0.0.1:${PORT} → PC 127.0.0.1:${PORT}`);
console.log(`Using: ${adb}`);
const list = spawnSync(adb, ['reverse', '--list'], { encoding: 'utf8' });
if (list.stdout) process.stdout.write(list.stdout);
