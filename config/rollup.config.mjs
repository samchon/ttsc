// `@rollup/plugin-typescript` statically imports the classic `typescript` JS
// API, which native TypeScript 7 drops. This package pins a legacy v6
// `typescript`, so the plugin's peer resolves to v6 here.
import typescript from "@rollup/plugin-typescript";

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
