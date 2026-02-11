const fs = require("fs");
const path = require("path");

// Define the target iOS deployment target version you want
const targetVersion = "14.0";

// Path to the iOS Podfile
const podfilePath = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "node_modules",
  "@codetrix-studio",
  "capacitor-google-auth",
  "CodetrixStudioCapacitorGoogleAuth.podspec"
);

// Function to update the deployment target in the Podfile
function updatePodfileDeploymentTarget() {
  if (fs.existsSync(podfilePath)) {
    let podfileContent = fs.readFileSync(podfilePath, "utf8");

    // Read the Podspec file
    fs.readFile(podfilePath, "utf8", (err, data) => {
      if (err) {
        console.error("Error reading Podspec file:", err);
        return;
      }

      // Replace the deployment target line
      const updatedData = data.replace(
        /s\.ios\.deployment_target\s*=\s*'12\.0'/,
        "s.ios.deployment_target  = '14.0'"
      );

      // Write the updated data back to the Podspec file
      fs.writeFile(podfilePath, updatedData, "utf8", (err) => {
        if (err) {
          console.error("Error writing to Podspec file:", err);
          return;
        }
        console.log(
          "Updated s.ios.deployment_target to '14.0' in",
          podfileContent
        );
      });
    });
  } else {
    console.error("Podfile not found at", podfilePath);
  }
}

// updatePodfileDeploymentTarget();
