import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL(".", import.meta.url));
const source = path.resolve(root, "../../src");
export default defineConfig({
  root,
  server: {
    host: "0.0.0.0",
    port: 3217,
    fs: { allow: [path.resolve(root, "../../../..")] },
  },
  resolve: {
    alias: [
      ...[
        "helpers/useUsers",
        "helpers/useCurrentUser",
        "helpers/useQs",
        "ducks/devices",
        "ducks/ePaper/papersApi",
        "react-router-dom",
        "react-i18next",
        "@progressiveui/react",
      ].map((find) => ({
        find,
        replacement: path.join(root, "environment.tsx"),
      })),
      {
        find: /^(.*\/)?useIntegrationForm$/,
        replacement: path.join(root, "form.tsx"),
      },
      {
        find: /^(.*\/)?IntegrationModal$/,
        replacement: path.join(root, "modal.tsx"),
      },
      {
        find: /^(.*\/)?ImageEditorElements$/,
        replacement: path.join(root, "empty.tsx"),
      },
      {
        find: /^(.*\/)?Fields\/Preview$/,
        replacement: path.join(root, "empty.tsx"),
      },
      ...["helpers", "ducks", "components", "translation", "scss"].map(
        (name) => ({ find: name, replacement: path.join(source, name) })
      ),
    ],
  },
  plugins: [
    {
      name: "test-results",
      configureServer(server) {
        server.middlewares.use("/results", (req, res) => {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
          });
          req.on("end", () => {
            console.log("MOBILE_IMPORT_RESULT", body);
            res.end("ok");
          });
        });
      },
    },
  ],
});
