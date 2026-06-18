import nodeResolve from "@rollup/plugin-node-resolve";
import { globSync } from "tinyglobby";

// The CJS `lib/**/*.js` is emitted by `tsgo -p .`; the ESM `lib/**/*.mjs` is
// produced from a separate ESM emit (`lib-esm/`, `tsgo -p tsconfig.esm.json`).
// Feeding rollup ESM input keeps the output a clean 1:1 module graph — no
// `@rollup/plugin-commonjs` wrapping, so no `_virtual/` shims, no `*2.mjs`
// facades, and no synthetic per-module `default` exports. node-resolve only
// rewrites extensionless / directory relative imports to their `.mjs` targets.
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
