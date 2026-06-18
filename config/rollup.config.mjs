import nodeResolve from "@rollup/plugin-node-resolve";
import { globSync } from "tinyglobby";

// Re-emit the compiled `lib/**/*.js` tree as `[name].mjs` siblings via rollup;
// nodeResolve resolves extensionless / directory-index relative imports.
export default {
  input: globSync("./lib/**/*.js"),
  output: {
    dir: "./lib",
    format: "esm",
    sourcemap: true,
    entryFileNames: "[name].mjs",
    preserveModules: true,
    preserveModulesRoot: "lib",
  },
  plugins: [nodeResolve({ extensions: [".js"] })],
};
