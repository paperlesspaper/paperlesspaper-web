const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

// Inspect the built artifact, not only the source plist: build settings can
// override it. iOS 27 terminates apps linked with SDK 27 without scene support.
function validateIosRelease(artifact) {
  let plist;
  let entries;
  if (artifact.endsWith(".ipa")) {
    entries = execFileSync("/usr/bin/unzip", ["-Z1", artifact], { encoding: "utf8" }).split("\n");
    const entry = entries.find((name) => /^Payload\/[^/]+\.app\/Info\.plist$/.test(name));
    if (!entry) throw new Error("IPA does not contain an application Info.plist");
    plist = execFileSync("/usr/bin/unzip", ["-p", artifact, entry]);
  } else {
    plist = fs.readFileSync(path.join(artifact, "Info.plist"));
  }
  const info = JSON.parse(execFileSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", "-"], {
    input: plist,
    encoding: "utf8",
  }));
  const sdk = Number.parseInt((info.DTSDKName || "").replace(/^iphoneos/, ""), 10);
  if (!Number.isFinite(sdk)) throw new Error("Cannot determine the iOS SDK of this release artifact");
  if (sdk >= 27) {
    const scenes = info.UIApplicationSceneManifest?.UISceneConfigurations?.UIWindowSceneSessionRoleApplication;
    const scene = scenes?.find((configuration) =>
      configuration.UISceneConfigurationName === "Default Configuration" &&
      configuration.UISceneDelegateClassName === "App.SceneDelegate" &&
      configuration.UISceneStoryboardFile === "Main"
    );
    if (!scene) {
      throw new Error("iOS 27 release is missing the configured SceneDelegate/Main scene; this build crashes on launch. Upload stopped.");
    }
    const hasStoryboard = entries
      ? entries.some((name) => /^Payload\/[^/]+\.app\/(?:Base\.lproj\/)?Main\.storyboardc\//.test(name))
      : ["Base.lproj/Main.storyboardc", "Main.storyboardc"].some((name) => fs.existsSync(path.join(artifact, name)));
    if (!hasStoryboard) throw new Error("The scene's Main.storyboard is missing from the built application");
    const controllerClass = Buffer.from("_TtC3App20BridgeViewController");
    const controllerNibs = entries
      ? entries.filter((name) => /^Payload\/[^/]+\.app\/(?:Base\.lproj\/)?Main\.storyboardc\/[^/]+\.nib$/.test(name))
        .map((name) => execFileSync("/usr/bin/unzip", ["-p", artifact, name]))
      : ["Base.lproj/Main.storyboardc", "Main.storyboardc"]
        .map((name) => path.join(artifact, name))
        .filter((directory) => fs.existsSync(directory))
        .flatMap((directory) => fs.readdirSync(directory)
          .filter((name) => name.endsWith(".nib"))
          .map((name) => fs.readFileSync(path.join(directory, name))));
    if (!controllerNibs.some((nib) => nib.includes(controllerClass))) {
      throw new Error("iOS 27 release is missing the BridgeViewController startup configuration workaround. Upload stopped.");
    }
  }
  return `${info.CFBundleShortVersionString} (${info.CFBundleVersion}), ${info.DTSDKName}`;
}

if (require.main === module) {
  try {
    const artifact = process.argv[2];
    if (!artifact) throw new Error("Usage: node scripts/validate_ios_release.cjs <App.ipa|App.app>");
    console.log(`iOS release configuration verified: ${validateIosRelease(artifact)}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { validateIosRelease };
