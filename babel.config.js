module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated v3 (legacy arch); must stay last. v4 would require newArchEnabled.
    plugins: ['react-native-reanimated/plugin'],
  };
};
