const { withDangerousMod } = require('@expo/config-plugins');
const generateCode = require('@expo/config-plugins/build/utils/generateCode');
const path = require('node:path');
const fs = require('node:fs');

const withMobileVlcKit = (config, options) => {
  if (!options?.ios?.includeVLCKit) return config;

  return withDangerousMod(config, [
    'ios',
    (modConfig) => {
      const filePath = path.join(modConfig.modRequest.platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(filePath, 'utf-8');
      const newCode = generateCode.mergeContents({
        tag: 'withVlcMediaPlayer',
        src: contents,
        newSrc: "  pod 'MobileVLCKit', '3.3.10'",
        anchor: /use_expo_modules!/i,
        offset: 3,
        comment: '  #',
      });
      fs.writeFileSync(filePath, newCode.contents);
      return modConfig;
    },
  ]);
};

module.exports = withMobileVlcKit;
