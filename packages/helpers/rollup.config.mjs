// rollup.config.js
/*import resolve from "@rollup/plugin-node-resolve";
import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";

export default {
  input: "src/index.js",
  output: {
    file: "build/bundle.js",
    format: "esm",
  },
  plugins: [commonjs(), resolve(), babel({ babelHelpers: "bundled" })],
};
*/
// Contents of the file /rollup.config.js
import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";
import dts from "rollup-plugin-dts";
const config = [
  {
    input: "build/compiled/index.js",
    output: {
      file: "build/bundle.js",
      format: "cjs",
      sourcemap: true,
    },
    external: ["axios", "os", "url"],
    plugins: [json(), typescript({ resolveJsonModule: true })],
  },
  {
    input: "build/compiled/index.js",
    plugins: [dts()],
    output: {
      file: `dist/bundle.d.ts`,
      format: "es",
    },
  },
  /*{
    input: "build/compiled/index.d.ts",
    output: {
      file: "lockstep-api.d.ts",
      format: "es",
    },
    plugins: [dts()],
  },*/
];
export default config;
