module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated plugin must stay last. v4+ requires the New Architecture.
    plugins: ['react-native-reanimated/plugin'],
  };
};
