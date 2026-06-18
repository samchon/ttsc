import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import autoExternal from "rollup-plugin-auto-external";
import nodeExternals from "rollup-plugin-node-externals";
import { globSync } from "tinyglobby";
// `@rollup/plugin-typescript` is re-exported from the build-config package so
// its `typescript` peer resolves to the legacy v6 compiler pinned there; native
// TypeScript 7 drops the classic JS API the plugin needs.
import typescript from "../../config/typescript-plugin.mjs";

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
