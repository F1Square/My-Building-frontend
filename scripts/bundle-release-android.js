/**
 * Cross-platform wrapper for Gradle bundleRelease with production env inlined into the JS bundle.
 * Sets EXPO_USE_PRODUCTION_ENV=1 so metro.config.js loads .env.production (see package.json).
 */

const fs = require('fs');
const path = require('path');

process.env.EXPO_USE_PRODUCTION_ENV = '1';

const root = path.join(__dirname, '..');
const envProduction = path.join(root, '.env.production');
const keystoreProps = path.join(root, 'android', 'keystore.properties');

function fail(msg) {
  console.error(`\n[android:bundle:release] ${msg}\n`);
  process.exit(1);
}

if (!fs.existsSync(keystoreProps)) {
  fail(
    'Missing android/keystore.properties.\n' +
      '  1. Copy android/keystore.properties.example → android/keystore.properties\n' +
      '  2. Add your Play keystore path, alias, and passwords (do not commit this file).'
  );
}

if (!fs.existsSync(envProduction)) {
  fail(
    'Missing .env.production in project root.\n' +
      '  1. Copy .env.production.example → .env.production\n' +
      '  2. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (Supabase → Settings → API)\n' +
      '  3. Adjust API URLs if your backend is not my-building-backend.vercel.app'
  );
}

const envText = fs.readFileSync(envProduction, 'utf8');
if (
  /your-project\.supabase\.co|your-anon-key|YOUR_LOCAL/i.test(envText) ||
  envText.includes('your-anon-key-here')
) {
  console.warn(
    '\n[android:bundle:release] Warning: .env.production still looks like a template. Replace Supabase URL and anon key with real values from the Supabase dashboard.\n'
  );
}

const { execSync } = require('child_process');
const androidDir = path.join(root, 'android');
const isWin = process.platform === 'win32';
const gradle = isWin ? 'gradlew.bat' : './gradlew';

execSync(`${gradle} bundleRelease`, {
  cwd: androidDir,
  stdio: 'inherit',
  env: { ...process.env, EXPO_USE_PRODUCTION_ENV: '1' },
});

console.log('\n[android:bundle:release] Done. AAB: android/app/build/outputs/bundle/release/app-release.aab\n');
