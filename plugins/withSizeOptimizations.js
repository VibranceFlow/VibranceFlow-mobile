const { withAppBuildGradle, withGradleProperties } = require('@expo/config-plugins');

function setGradleProperties(config) {
  return withGradleProperties(config, (config) => {
    // Add size optimization properties
    const propertiesToAdd = [
      { type: 'property', key: 'android.enableMinifyInReleaseBuilds', value: 'true' },
      { type: 'property', key: 'android.enableShrinkResourcesInReleaseBuilds', value: 'true' },
      { type: 'property', key: 'expo.gif.enabled', value: 'false' },
      { type: 'property', key: 'expo.webp.enabled', value: 'false' },
      { type: 'property', key: 'expo.webp.animated', value: 'false' }
    ];

    propertiesToAdd.forEach((prop) => {
      // Avoid duplicates
      const index = config.modResults.findIndex(p => p.key === prop.key);
      if (index >= 0) {
        config.modResults[index] = prop;
      } else {
        config.modResults.push(prop);
      }
    });

    return config;
  });
}

function setAppBuildGradle(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      const splitsConfig = `
    splits {
        abi {
            reset()
            enable true
            universalApk true
            include (*reactNativeArchitectures.split(','))
        }
    }`;
      // Insert after defaultConfig block if it doesn't already exist
      if (!config.modResults.contents.includes('splits {')) {
        config.modResults.contents = config.modResults.contents.replace(
          /(defaultConfig\s*\{[\s\S]*?\n\s*\})/,
          match => match + '\n' + splitsConfig
        );
      }
    }
    return config;
  });
}

module.exports = function withSizeOptimizations(config) {
  config = setGradleProperties(config);
  config = setAppBuildGradle(config);
  return config;
};