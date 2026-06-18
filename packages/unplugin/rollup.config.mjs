import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import autoExternal from "rollup-plugin-auto-external";
import nodeExternals from "rollup-plugin-node-externals";
import { globSync } from "tinyglobby";
// The native TypeScript 7 (`typescript`) compiler ships no classic JS API, so
// `@rollup/plugin-typescript` is driven by the legacy v6 compiler pinned as the
// `ts-legacy` alias.
import ts from "ts-legacy";

const inputs = globSync("./src/**/*.ts");
const externalPackages = ["ttsc", "unplugin"];
const external = (id) =>
  id.startsWith("node:") ||
  externalPackages.some((name) => id === name || id.startsWith(`${name}/`));

const output = (format, extension) => ({
  dir: "./lib",
  entryFileNames: (chunkInfo) => {
    if (chunkInfo.name.includes("node_modules")) {
      throw new Error(`Invalid chunk name: ${chunkInfo.name}`);
    }
    return `[name].${extension}`;
  },
  exports: "named",
  format,
  preserveModules: true,
  preserveModulesRoot: "src",
  sourcemap: true,
});

export default {
  external,
  input: inputs,
  output: [output("cjs", "js"), output("esm", "mjs")],
  plugins: [
    nodeExternals(),
    autoExternal(),
    nodeResolve({
      extensions: [".mjs", ".js", ".json", ".ts"],
    }),
    commonjs(),
    typescript({
      typescript: ts,
      compilerOptions: {
        declaration: false,
        declarationMap: false,
        emitDeclarationOnly: false,
        module: "ESNext",
        moduleResolution: "Bundler",
        noEmit: false,
      },
      tsconfig: "tsconfig.json",
    }),
  ],
};
