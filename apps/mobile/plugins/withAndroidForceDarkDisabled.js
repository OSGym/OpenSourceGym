const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * Android 10+'s automatic "Force Dark" re-tints already-dark app content,
 * shifting our near-black palette (#060607/#0d0d0f) toward navy. The app
 * ships its own dark theme, so opt the whole application out.
 */
module.exports = function withAndroidForceDarkDisabled(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (application) {
      application.$["android:forceDarkAllowed"] = "false";
    }
    return config;
  });
};
