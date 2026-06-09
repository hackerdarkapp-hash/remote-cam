const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withMainApplication,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const KOTLIN_FILES = [
  "StreamingService.kt",
  "BootReceiver.kt",
  "StreamingModule.kt",
  "StreamingPackage.kt",
];

function withStreamingManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const app = manifest.application[0];

    const extraPerms = [
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_CAMERA",
      "android.permission.RECEIVE_BOOT_COMPLETED",
      "android.permission.WAKE_LOCK",
    ];
    if (!manifest["uses-permission"]) manifest["uses-permission"] = [];
    for (const perm of extraPerms) {
      if (!manifest["uses-permission"].find((p) => p.$?.["android:name"] === perm)) {
        manifest["uses-permission"].push({ $: { "android:name": perm } });
      }
    }

    if (!app.service) app.service = [];
    if (!app.service.find((s) => s.$?.["android:name"] === ".StreamingService")) {
      app.service.push({
        $: {
          "android:name": ".StreamingService",
          "android:foregroundServiceType": "camera",
          "android:exported": "false",
          "android:stopWithTask": "false",
        },
      });
    }

    if (!app.receiver) app.receiver = [];
    if (!app.receiver.find((r) => r.$?.["android:name"] === ".BootReceiver")) {
      app.receiver.push({
        $: {
          "android:name": ".BootReceiver",
          "android:exported": "true",
          "android:enabled": "true",
        },
        "intent-filter": [
          {
            action: [
              { $: { "android:name": "android.intent.action.BOOT_COMPLETED" } },
              { $: { "android:name": "android.intent.action.MY_PACKAGE_REPLACED" } },
              { $: { "android:name": "android.intent.action.LOCKED_BOOT_COMPLETED" } },
            ],
          },
        ],
      });
    }

    return config;
  });
}

function withStreamingGradle(config) {
  return withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes("camera-lifecycle")) {
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies\s*\{/,
        `dependencies {
    implementation 'androidx.camera:camera-core:1.4.2'
    implementation 'androidx.camera:camera-camera2:1.4.2'
    implementation 'androidx.camera:camera-lifecycle:1.4.2'
    implementation 'androidx.concurrent:concurrent-futures:1.2.0'
    implementation('io.socket:socket.io-client:2.1.0') {
        exclude group: 'org.json', module: 'json'
    }`
      );
    }
    return config;
  });
}

function withStreamingKotlinFiles(config) {
  return withDangerousMod(config, [
    "android",
    (config) => {
      const androidSrc = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/java/com/remotecam"
      );
      fs.mkdirSync(androidSrc, { recursive: true });

      const pluginAndroidDir = path.join(__dirname, "android");
      for (const file of KOTLIN_FILES) {
        const src = path.join(pluginAndroidDir, file);
        const dest = path.join(androidSrc, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
          console.log(`[with-background-streaming] Copied ${file}`);
        } else {
          console.warn(`[with-background-streaming] Missing: ${src}`);
        }
      }
      return config;
    },
  ]);
}

function withStreamingPackage(config) {
  return withMainApplication(config, (config) => {
    const src = config.modResults.contents;
    if (!src.includes("StreamingPackage")) {
      config.modResults.contents = src.replace(
        /PackageList\(this\)\.packages/,
        "PackageList(this).packages.also { it.add(StreamingPackage()) }"
      );
    }
    return config;
  });
}

module.exports = function withBackgroundStreaming(config) {
  config = withStreamingManifest(config);
  config = withStreamingGradle(config);
  config = withStreamingKotlinFiles(config);
  config = withStreamingPackage(config);
  return config;
};
