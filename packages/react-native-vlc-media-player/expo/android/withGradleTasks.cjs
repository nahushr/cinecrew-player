const { withAppBuildGradle } = require('@expo/config-plugins');
const generateCode = require('@expo/config-plugins/build/utils/generateCode');

const resolveAppGradleString = (options) => {
  const rnJetifierName = options?.android?.legacyJetifier
    ? 'jetified-react-native'
    : 'jetified-react-android';

  return `tasks.whenTaskAdded((tas -> {
        if (tas.name.contains("merge") && tas.name.contains("NativeLibs")) {
            tasks.named(tas.name) {it
                doFirst {
                    java.nio.file.Path notNeededDirectory = it.externalLibNativeLibs
                            .getFiles()
                            .stream()
                            .filter(file -> file.toString().contains("${rnJetifierName}"))
                            .findAny()
                            .orElse(null)
                            .toPath();
                    java.nio.file.Files.walk(notNeededDirectory).forEach(file -> {
                        if (file.toString().contains("libc++_shared.so")) {
                            java.nio.file.Files.delete(file);
                        }
                    });
                }
            }
        }
    }))`;
};

const withGradleTasks = (config, options) => {
  if (!options?.android) return config;

  return withAppBuildGradle(config, (modConfig) => {
    const newCode = generateCode.mergeContents({
      tag: 'withVlcMediaPlayer',
      src: modConfig.modResults.contents,
      newSrc: resolveAppGradleString(options),
      anchor: /applyNativeModulesAppBuildGradle\(project\)/i,
      offset: 2,
      comment: '//',
    });

    modConfig.modResults.contents = newCode.contents;
    return modConfig;
  });
};

module.exports = withGradleTasks;
