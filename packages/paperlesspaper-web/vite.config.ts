import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tsconfigPaths from "vite-tsconfig-paths";
import EnvironmentPlugin from "vite-plugin-environment";
import viteCommonjs from "vite-plugin-commonjs";
import svgr from "vite-plugin-svgr";
import path from "path";
import eslint from "vite-plugin-eslint";

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
  },
  preview: {
    port: 3200,
  },
  // for dev
  server: {
    port: 3200,
  },
  envPrefix: "REACT_APP_",
});
