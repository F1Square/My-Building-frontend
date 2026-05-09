const path = require('path');
const fs = require('fs');
const { getDefaultConfig } = require('expo/metro-config');

const root = __dirname;

// Base local overrides
require('dotenv').config({ path: path.join(root, '.env') });

// Play Store / production bundle: set EXPO_USE_PRODUCTION_ENV=1 (see package.json "android:bundle:release")
// so Metro inlines EXPO_PUBLIC_* from .env.production before Gradle embeds the JS bundle.
const useProductionEnv =
  process.env.EXPO_USE_PRODUCTION_ENV === '1' ||
  process.env.NODE_ENV === 'production';

if (useProductionEnv && fs.existsSync(path.join(root, '.env.production'))) {
  require('dotenv').config({
    path: path.join(root, '.env.production'),
    override: true,
  });
}

module.exports = getDefaultConfig(__dirname);
