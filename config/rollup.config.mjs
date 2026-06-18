import typescript from "@rollup/plugin-typescript";
// The native TypeScript 7 (`typescript`) compiler ships no classic JS API, so
// `@rollup/plugin-typescript` is driven by the legacy v6 compiler pinned as the
// `ts-legacy` alias.
import ts from "ts-legacy";

export default {
  input: "src/index.ts",
  output: {
    dir: "lib",
    format: "esm",
    // Emit one .mjs per source module (mirroring tsgo's per-file CJS .js)
    // instead of bundling everything into a single file.
    preserveModules: true,
    preserveModulesRoot: "src",
    entryFileNames: "[name].mjs",
    sourcemap: true,
  },
  plugins: [
    typescript({
      typescript: ts,
      tsconfig: "tsconfig.json",
      module: "esnext",
      moduleResolution: "bundler",
      declaration: false,
      declarationMap: false,
      outDir: "lib",
      sourceMap: true,
    }),
  ],
};
