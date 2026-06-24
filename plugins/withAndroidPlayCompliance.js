/**
 * Play Store compliance for Android 16+ large screens and transitive ML Kit manifest entries.
 * - Excludes unused ML Kit barcode scanner dependencies (portrait-locked activity in merged manifest)
 * - Overrides any remaining ML Kit activity to be resizable / orientation-unspecified
 * - Ensures MainActivity supports large screens
 */
const {
  withAndroidManifest,
  withAppBuildGradle,
  AndroidConfig,
} = require('expo/config-plugins');

const MLKIT_BARCODE_ACTIVITY =
  'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity';

const GRADEMARKER = 'play-services-mlkit-barcode-scanning';

const GRADLE_EXCLUDES = `
    configurations.configureEach {
        exclude group: 'com.google.android.gms', module: 'play-services-mlkit-barcode-scanning'
        exclude group: 'com.google.android.gms', module: 'play-services-code-scanner'
        exclude group: 'com.google.mlkit', module: 'barcode-scanning'
    }
`;

function ensureToolsNamespace(manifest) {
  if (!manifest.manifest.$) manifest.manifest.$ = {};
  if (!manifest.manifest.$['xmlns:tools']) {
    manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
  }
}

function withMlkitManifestOverride(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    ensureToolsNamespace(manifest);

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    if (!application.activity) application.activity = [];

    const mlkitAttrs = {
      'android:name': MLKIT_BARCODE_ACTIVITY,
      'android:screenOrientation': 'unspecified',
      'android:resizeableActivity': 'true',
      'tools:replace': 'android:screenOrientation,android:resizeableActivity',
    };

    const mlkitIndex = application.activity.findIndex(
      (activity) => activity.$?.['android:name'] === MLKIT_BARCODE_ACTIVITY
    );
    if (mlkitIndex >= 0) {
      application.activity[mlkitIndex].$ = {
        ...application.activity[mlkitIndex].$,
        ...mlkitAttrs,
      };
    } else {
      application.activity.push({ $: mlkitAttrs });
    }

    for (const activity of application.activity) {
      const name = activity.$?.['android:name'] || '';
      if (name === '.MainActivity' || name.endsWith('.MainActivity')) {
        activity.$['android:resizeableActivity'] = 'true';
        delete activity.$['android:screenOrientation'];
      }
    }

    return config;
  });
}

function withMlkitGradleExclude(config) {
  return withAppBuildGradle(config, (config) => {
    let { contents } = config.modResults;
    if (!contents.includes(GRADEMARKER)) {
      contents = contents.replace(/\ndependencies\s*\{/, `\n${GRADLE_EXCLUDES}\ndependencies {`);
    }
    config.modResults.contents = contents;
    return config;
  });
}

module.exports = function withAndroidPlayCompliance(config) {
  config = withMlkitManifestOverride(config);
  config = withMlkitGradleExclude(config);
  return config;
};
