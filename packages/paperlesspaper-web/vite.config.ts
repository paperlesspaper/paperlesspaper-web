import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tsconfigPaths from "vite-tsconfig-paths";
import viteCommonjs from "vite-plugin-commonjs";
import svgr from "vite-plugin-svgr";
import path from "path";
import eslint from "vite-plugin-eslint";

const allowedHosts = [
  "web.paperlesspaper.de",
  process.env.REACT_APP_AUTH_REDIRECT_URL
    ? new URL(process.env.REACT_APP_AUTH_REDIRECT_URL).hostname
    : undefined,
  ...(process.env.ALLOWED_HOSTS?.split(",").map((host) => host.trim()) ?? []),
].filter((host): host is string => Boolean(host));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    svgr(),
    viteCommonjs(),
    eslint(),

    /*EnvironmentPlugin([
      "NODE_PATH",
      "REACT_APP_AUTH0_CLIENT_ID",
      "REACT_APP_AUTH0_DOMAIN",
      "REACT_APP_AUTH0_AUDIENCE",
      "REACT_APP_AUTH0_REDIRECT_URI",
      "REACT_APP_SERVER_BASE_URL",
      "REACT_APP_AUTH_REDIRECT_URL",
      "REACT_APP_VERSION",
      "REACT_APP_NAME",
    ]),*/
  ],
  resolve: {
    alias: {
      scss: path.resolve(__dirname, "src/scss"),
    },
    dedupe: ["react", "react-dom"],
  },
  css: {
    preprocessorOptions: {
      scss: {
        quietDeps: true,
        logger: {
          warn: (message: string, options: { deprecation?: boolean } = {}) => {
            if (options.deprecation) {
              return;
            }
            console.warn(message);
          },
        },
      },
    },
  },
  preview: {
    port: 3200,
    allowedHosts,
  },
  // for dev
  server: {
    port: 3200,
    allowedHosts,
  },
  envPrefix: "REACT_APP_",
});
