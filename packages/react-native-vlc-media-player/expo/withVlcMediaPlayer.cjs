const withGradleTasks = require('./android/withGradleTasks.cjs');
const withMobileVlcKit = require('./ios/withMobileVlcKit.cjs');

const withVlcMediaPlayer = (config, options) => {
  config = withGradleTasks(config, options);
  config = withMobileVlcKit(config, options);
  return config;
};

module.exports = withVlcMediaPlayer;
