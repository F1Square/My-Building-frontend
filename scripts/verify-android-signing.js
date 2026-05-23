/**
 * Verify release keystore exists and print upload certificate fingerprints
 * (compare SHA-1 in Play Console → Setup → App signing → Upload key certificate).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const keystorePropsPath = path.join(root, 'android', 'keystore.properties');

function fail(msg) {
  console.error(`\n[verify-android-signing] ${msg}\n`);
  process.exit(1);
}

if (!fs.existsSync(keystorePropsPath)) {
  fail('Missing android/keystore.properties — copy scripts/keystore.properties.example');
}

const props = Object.fromEntries(
  fs
    .readFileSync(keystorePropsPath, 'utf8')
    .split('\n')
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    })
);

const { storeFile, storePassword, keyAlias, keyPassword } = props;
if (!storeFile || !storePassword || !keyAlias || !keyPassword) {
  fail('keystore.properties must set storeFile, storePassword, keyAlias, keyPassword');
}

const keystorePath = path.join(root, 'android', 'app', storeFile);
if (!fs.existsSync(keystorePath)) {
  fail(`Keystore not found at android/app/${storeFile}`);
}

const out = execSync(
  `keytool -list -v -keystore "${keystorePath}" -storepass "${storePassword}" -alias "${keyAlias}"`,
  { encoding: 'utf8' }
);

const sha1 = out.match(/SHA1:\s*(.+)/)?.[1]?.trim();
const sha256 = out.match(/SHA256:\s*(.+)/)?.[1]?.trim();

console.log('\n[verify-android-signing] Release signing OK');
console.log(`  Keystore : android/app/${storeFile}`);
console.log(`  Key alias: ${keyAlias}`);
if (sha1) console.log(`  SHA-1    : ${sha1}`);
if (sha256) console.log(`  SHA-256  : ${sha256}`);
console.log('\nCompare SHA-1 with Play Console → Setup → App integrity → Upload key certificate.\n');
