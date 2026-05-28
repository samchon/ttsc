import cp from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const experimentRoot = path.resolve(import.meta.dirname, "..");
const root = path.resolve(experimentRoot, "../..");
const tarballs = path.join(root, "experimental", "tarballs");
const workspace = path.join(experimentRoot, ".tmp", "project");
const skipPack = process.argv.includes("--skip-pack");
const packCurrent = process.argv.includes("--pack-current");
const platformKey = `${process.platform}-${process.arch}`;
const platformTarball = `ttsc-${platformKey}`;
const registryDependencies = [
  "@farmfe/core",
  // Rspack 2.0.1+ crashes on Windows ARM64 during native binding teardown.
  "@rspack/cli@2.0.0",
  "@rspack/core@2.0.0",
  "@types/react",
  "@types/react-dom",
  "@typescript/native-preview",
  "esbuild",
  "next",
  "rolldown",
  "rollup",
  "react",
  "react-dom",
  "vite",
  "webpack",
  "webpack-cli",
];
const adapterEntrypoints = [
  "bun",
  "esbuild",
  "farm",
  "next",
  "rolldown",
  "rollup",
  "rspack",
  "vite",
  "webpack",
];

main();

function main() {
  if (packCurrent) {
    prepareCurrentTarballs();
  } else if (!skipPack) {
    run("pnpm package:tgz", root);
  }
  prepareWorkspace();
  installTarballs();
  verifyEntrypoints();
  verifyViteBuild();
  verifyRollupBuild();
  verifyRolldownBuild();
  verifyEsbuildBuild();
  verifyWebpackBuild();
  verifyRspackBuild();
  verifyFarmBuild();
  verifyNextBuild();
  verifyBunBuild();
  console.log("Success");
}

function prepareCurrentTarballs() {
  run("pnpm run build:current", root);

  fs.mkdirSync(tarballs, { recursive: true });
  for (const name of ["ttsc", platformTarball, "unplugin"]) {
    fs.rmSync(path.join(tarballs, `${name}.tgz`), { force: true });
  }

  packPackage("ttsc", "ttsc");
  packPackage(platformTarball, platformTarball);
  packPackage("unplugin", "unplugin");
}

function packPackage(packageDirName, tarballName) {
  const packageDir = path.join(root, "packages", packageDirName);
  assert(fs.existsSync(packageDir), `${packageDirName} package must exist`);

  for (const entry of fs.readdirSync(packageDir)) {
    if (entry.endsWith(".tgz")) {
      fs.rmSync(path.join(packageDir, entry), { force: true });
    }
  }

  run("pnpm pack", packageDir);
  const packed = fs
    .readdirSync(packageDir)
    .find((entry) => entry.endsWith(".tgz"));
  assert(packed, `${packageDirName} package tarball must be created`);
  fs.copyFileSync(
    path.join(packageDir, packed),
    path.join(tarballs, `${tarballName}.tgz`),
  );
}

function prepareWorkspace() {
  fs.rmSync(path.join(experimentRoot, ".tmp"), {
    recursive: true,
    force: true,
  });
  fs.mkdirSync(path.join(workspace, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(workspace, "package.json"),
    JSON.stringify(
      {
        private: true,
        name: "@ttsc/experimental-test-unplugin-consumer",
        version: "0.0.0",
        type: "module",
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(workspace, "tsconfig.unplugin.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          strict: true,
          rootDir: ".",
          jsx: "preserve",
          plugins: [
            {
              transform: "./unplugin-transform.cjs",
            },
          ],
        },
        include: ["src", "pages"],
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(workspace, "tsconfig.json"),
    JSON.stringify(
      {
        extends: "./tsconfig.unplugin.json",
        compilerOptions: {
          allowJs: true,
          esModuleInterop: true,
          incremental: true,
          isolatedModules: true,
          lib: ["dom", "dom.iterable", "es2022"],
          moduleResolution: "Bundler",
          noEmit: true,
          resolveJsonModule: true,
        },
        include: ["next-env.d.ts", "pages", "src"],
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(workspace, "next-env.d.ts"),
    [
      '/// <reference types="next" />',
      '/// <reference types="next/image-types/global" />',
      "",
    ].join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(workspace, "src", "globals.d.ts"),
    "declare function mark(input: string): string;\n",
    "utf8",
  );
  writeSource("vite-entry.ts", "vite-installed-ok");
  writeSource("rollup-entry.ts", "rollup-installed-ok");
  writeSource("rolldown-entry.ts", "rolldown-installed-ok");
  writeSource("esbuild-entry.ts", "esbuild-installed-ok");
  writeSource("webpack-entry.ts", "webpack-installed-ok");
  writeSource("rspack-entry.ts", "rspack-installed-ok");
  writeSource("farm-entry.ts", "farm-installed-ok");
  writeSource("next-entry.ts", "next-installed-ok");
  writeSource("bun-entry.ts", "bun-installed-ok");
  writeNextPage();
  writeTransformPlugin();
  writeViteConfig();
  writeRollupConfig();
  writeRolldownConfig();
  writeEsbuildConfig();
  writeWebpackConfig();
  writeRspackConfig();
  writeFarmConfig();
  writeNextConfig();
  writeBunConfig();
}

function writeSource(file, marker) {
  fs.writeFileSync(
    path.join(workspace, "src", file),
    [`export const value = mark("${marker}");`, "console.log(value);", ""].join(
      "\n",
    ),
    "utf8",
  );
}

function writeNextPage() {
  fs.mkdirSync(path.join(workspace, "pages"), { recursive: true });
  fs.writeFileSync(
    path.join(workspace, "pages", "index.js"),
    [
      'import { value } from "../src/next-entry";',
      "",
      "export default function Page() {",
      "  return value;",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
}

function writeTransformPlugin() {
  fs.writeFileSync(
    path.join(workspace, "unplugin-transform.cjs"),
    [
      'const path = require("node:path");',
      "",
      "module.exports = function createUnpluginTransform() {",
      "  return {",
      '    name: "experimental-unplugin-transform",',
      '    source: path.resolve(__dirname, "unplugin-transform-go"),',
      "  };",
      "};",
      "",
    ].join("\n"),
    "utf8",
  );
  fs.mkdirSync(path.join(workspace, "unplugin-transform-go"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(workspace, "unplugin-transform-go", "go.mod"),
    "module example.com/ttscunplugintest\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(workspace, "unplugin-transform-go", "main.go"),
    [
      "package main",
      "",
      "import (",
      '  "encoding/json"',
      '  "flag"',
      '  "fmt"',
      '  "io/fs"',
      '  "os"',
      '  "path/filepath"',
      '  "regexp"',
      '  "strings"',
      ")",
      "",
      'var markerCall = regexp.MustCompile(`mark\\("([^"]*)"\\)`)',
      "",
      "type transformResult struct {",
      '  TypeScript map[string]string `json:"typescript"`',
      "}",
      "",
      "func main() { os.Exit(run(os.Args[1:])) }",
      "",
      "func run(args []string) int {",
      "  if len(args) == 0 { return 2 }",
      "  switch args[0] {",
      '  case "transform":',
      "    return transform(args[1:])",
      '  case "check", "version", "build":',
      "    return 0",
      "  default:",
      '    fmt.Fprintf(os.Stderr, "unknown command %q\\n", args[0])',
      "    return 2",
      "  }",
      "}",
      "",
      "func transform(args []string) int {",
      '  flags := flag.NewFlagSet("transform", flag.ContinueOnError)',
      '  cwd := flags.String("cwd", "", "")',
      '  _ = flags.String("tsconfig", "", "")',
      '  _ = flags.String("plugins-json", "", "")',
      "  if err := flags.Parse(args); err != nil { return 2 }",
      "  root := *cwd",
      '  if root == "" { root, _ = os.Getwd() }',
      "  out := map[string]string{}",
      '  err := filepath.WalkDir(filepath.Join(root, "src"), func(file string, entry fs.DirEntry, err error) error {',
      "    if err != nil { return err }",
      '    if entry.IsDir() || strings.HasSuffix(file, ".d.ts") || (!strings.HasSuffix(file, ".ts") && !strings.HasSuffix(file, ".tsx")) {',
      "      return nil",
      "    }",
      "    source, err := os.ReadFile(file)",
      "    if err != nil { return err }",
      "    code := markerCall.ReplaceAllStringFunc(string(source), func(call string) string {",
      "      match := markerCall.FindStringSubmatch(call)",
      "      if len(match) != 2 { return call }",
      '      return fmt.Sprintf("%q", strings.ToUpper(match[1]))',
      "    })",
      "    relative, err := filepath.Rel(root, file)",
      "    if err != nil { return err }",
      "    out[filepath.ToSlash(relative)] = code",
      "    return nil",
      "  })",
      "  if err != nil { fmt.Fprintln(os.Stderr, err); return 2 }",
      '  if len(out) == 0 { fmt.Fprintln(os.Stderr, "no TypeScript sources found"); return 2 }',
      "  data, err := json.Marshal(transformResult{TypeScript: out})",
      "  if err != nil { fmt.Fprintln(os.Stderr, err); return 2 }",
      "  fmt.Fprintln(os.Stdout, string(data))",
      "  return 0",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
}

function writeNextConfig() {
  fs.writeFileSync(
    path.join(workspace, "next.config.mjs"),
    [
      'import withTtsc from "@ttsc/unplugin/next";',
      "",
      "export default withTtsc(",
      "  {",
      '    distDir: "dist-next",',
      "    typescript: {",
      "      ignoreBuildErrors: true,",
      "    },",
      "  },",
      "  {",
      '    project: "tsconfig.unplugin.json",',
      "  },",
      ");",
      "",
    ].join("\n"),
    "utf8",
  );
}

function writeViteConfig() {
  fs.writeFileSync(
    path.join(workspace, "vite.config.mjs"),
    [
      'import path from "node:path";',
      'import ttsc from "@ttsc/unplugin/vite";',
      'import { defineConfig } from "vite";',
      "",
      "export default defineConfig({",
      "  build: {",
      "    emptyOutDir: true,",
      "    minify: false,",
      '    outDir: "dist-vite",',
      "    rollupOptions: {",
      '      input: path.resolve("src/vite-entry.ts"),',
      "      output: {",
      '        entryFileNames: "vite-entry.js",',
      '        format: "es",',
      "      },",
      "    },",
      "  },",
      '  logLevel: "silent",',
      '  plugins: [ttsc({ project: "tsconfig.unplugin.json" })],',
      "});",
      "",
    ].join("\n"),
    "utf8",
  );
}

function writeRollupConfig() {
  fs.writeFileSync(
    path.join(workspace, "rollup.config.mjs"),
    [
      'import ttsc from "@ttsc/unplugin/rollup";',
      "",
      "export default {",
      '  input: "src/rollup-entry.ts",',
      "  output: {",
      '    file: "dist-rollup/rollup-entry.js",',
      '    format: "es",',
      "  },",
      '  plugins: [ttsc({ project: "tsconfig.unplugin.json" })],',
      "};",
      "",
    ].join("\n"),
    "utf8",
  );
}

function writeRolldownConfig() {
  fs.writeFileSync(
    path.join(workspace, "rolldown.config.mjs"),
    [
      'import ttsc from "@ttsc/unplugin/rolldown";',
      "",
      "export default {",
      '  input: "src/rolldown-entry.ts",',
      "  output: {",
      '    file: "dist-rolldown/rolldown-entry.js",',
      '    format: "es",',
      "  },",
      '  plugins: [ttsc({ project: "tsconfig.unplugin.json" })],',
      "};",
      "",
    ].join("\n"),
    "utf8",
  );
}

function writeEsbuildConfig() {
  fs.writeFileSync(
    path.join(workspace, "esbuild.config.cjs"),
    [
      'const esbuild = require("esbuild");',
      'const ttsc = require("@ttsc/unplugin/esbuild").default;',
      "",
      "esbuild",
      "  .build({",
      '  entryPoints: ["src/esbuild-entry.ts"],',
      "  bundle: true,",
      '  format: "esm",',
      '  outfile: "dist-esbuild/esbuild-entry.js",',
      '  plugins: [ttsc({ project: "tsconfig.unplugin.json" })],',
      "  })",
      "  .catch((error) => {",
      "    console.error(error);",
      "    process.exit(1);",
      "  });",
      "",
    ].join("\n"),
    "utf8",
  );
}

function writeWebpackConfig() {
  fs.writeFileSync(
    path.join(workspace, "webpack.config.cjs"),
    [
      'const path = require("node:path");',
      'const ttsc = require("@ttsc/unplugin/webpack").default;',
      "",
      "module.exports = {",
      '  mode: "production",',
      '  target: "node",',
      '  entry: path.resolve(__dirname, "src/webpack-entry.ts"),',
      "  output: {",
      '    path: path.resolve(__dirname, "dist-webpack"),',
      '    filename: "webpack-entry.js",',
      "  },",
      "  resolve: {",
      '    extensions: [".ts", ".js"],',
      "  },",
      "  module: {",
      "    rules: [",
      "      {",
      "        test: /\\.ts$/,",
      '        type: "javascript/auto",',
      "      },",
      "    ],",
      "  },",
      "  optimization: {",
      "    minimize: false,",
      "  },",
      '  plugins: [ttsc({ project: "tsconfig.unplugin.json" })],',
      "};",
      "",
    ].join("\n"),
    "utf8",
  );
}

function writeRspackConfig() {
  fs.writeFileSync(
    path.join(workspace, "rspack.config.cjs"),
    [
      'const path = require("node:path");',
      'const ttsc = require("@ttsc/unplugin/rspack").default;',
      "",
      "module.exports = {",
      '  mode: "production",',
      '  target: "node",',
      '  entry: path.resolve(__dirname, "src/rspack-entry.ts"),',
      "  output: {",
      '    path: path.resolve(__dirname, "dist-rspack"),',
      '    filename: "rspack-entry.js",',
      "  },",
      "  resolve: {",
      '    extensions: [".ts", ".js"],',
      "  },",
      "  module: {",
      "    rules: [",
      "      {",
      "        test: /\\.ts$/,",
      '        type: "javascript/auto",',
      "      },",
      "    ],",
      "  },",
      "  optimization: {",
      "    minimize: false,",
      "  },",
      '  plugins: [ttsc({ project: "tsconfig.unplugin.json" })],',
      "};",
      "",
    ].join("\n"),
    "utf8",
  );
}

function writeFarmConfig() {
  fs.writeFileSync(
    path.join(workspace, "farm-build.mjs"),
    [
      'import { build, defineConfig } from "@farmfe/core";',
      'import ttsc from "@ttsc/unplugin/farm";',
      "",
      "await build(",
      "  defineConfig({",
      "    compilation: {",
      "      input: {",
      '        farm: "./src/farm-entry.ts",',
      "      },",
      "      output: {",
      '        path: "./dist-farm",',
      '        entryFilename: "farm-entry.js",',
      '        filename: "[resourceName].js",',
      '        format: "esm",',
      '        targetEnv: "node",',
      "      },",
      "      minify: false,",
      "      persistentCache: false,",
      "    },",
      '    plugins: [ttsc({ project: "tsconfig.unplugin.json" })],',
      "  }),",
      ");",
      "",
    ].join("\n"),
    "utf8",
  );
}

function writeBunConfig() {
  fs.writeFileSync(
    path.join(workspace, "bun-build.mjs"),
    [
      'import ttsc from "@ttsc/unplugin/bun";',
      "",
      "const result = await Bun.build({",
      '  entrypoints: ["src/bun-entry.ts"],',
      '  outdir: "dist-bun",',
      '  format: "esm",',
      "  minify: false,",
      '  plugins: [ttsc({ project: "tsconfig.unplugin.json" })],',
      "});",
      "",
      "if (!result.success) {",
      "  for (const log of result.logs) console.error(log);",
      '  throw new Error("Bun build failed");',
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
}

function installTarballs() {
  const command = [
    "npm install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    // Retry transient npm registry errors (ECONNRESET / 5xx mid-stream
    // resets) before failing the run. Default `--fetch-retries=2` was
    // not enough on macOS runners; bump to 5 with explicit timeouts.
    "--fetch-retries=5",
    "--fetch-retry-mintimeout=10000",
    "--fetch-retry-maxtimeout=60000",
    ...registryDependencies,
    tarball("ttsc"),
    tarball(platformTarball),
    tarball("unplugin"),
  ].join(" ");
  run(command, workspace);
}

function verifyEntrypoints() {
  fs.writeFileSync(
    path.join(workspace, "verify-entrypoints.mjs"),
    [
      'const root = await import("@ttsc/unplugin");',
      'if (typeof root.default.vite !== "function") {',
      '  throw new Error("@ttsc/unplugin ESM default import must expose adapters");',
      "}",
      'const api = await import("@ttsc/unplugin/api");',
      'if (typeof api.transformTtsc !== "function") {',
      '  throw new Error("@ttsc/unplugin/api must expose transformTtsc");',
      "}",
      "for (const entrypoint of " + JSON.stringify(adapterEntrypoints) + ") {",
      "  const mod = await import(`@ttsc/unplugin/${entrypoint}`);",
      '  if (typeof mod.default !== "function") {',
      "    throw new Error(`${entrypoint} ESM default import must be a function`);",
      "  }",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  run("node verify-entrypoints.mjs", workspace);

  fs.writeFileSync(
    path.join(workspace, "verify-entrypoints.cjs"),
    [
      'const root = require("@ttsc/unplugin");',
      'if (typeof root.default.vite !== "function") {',
      '  throw new Error("@ttsc/unplugin CJS require must expose adapters");',
      "}",
      'const api = require("@ttsc/unplugin/api");',
      'if (typeof api.transformTtsc !== "function") {',
      '  throw new Error("@ttsc/unplugin/api must expose transformTtsc through CJS");',
      "}",
      "for (const entrypoint of " + JSON.stringify(adapterEntrypoints) + ") {",
      "  const mod = require(`@ttsc/unplugin/${entrypoint}`);",
      '  if (typeof mod.default !== "function") {',
      "    throw new Error(`${entrypoint} CJS require must expose a default function`);",
      "  }",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  run("node verify-entrypoints.cjs", workspace);
}

function verifyViteBuild() {
  run("npx vite build --config vite.config.mjs", workspace);
  assertBuiltOutput("dist-vite/vite-entry.js", "VITE-INSTALLED-OK", "vite");
}

function verifyRollupBuild() {
  run("npx rollup -c rollup.config.mjs", workspace);
  assertBuiltOutput(
    "dist-rollup/rollup-entry.js",
    "ROLLUP-INSTALLED-OK",
    "rollup",
  );
}

function verifyEsbuildBuild() {
  run("node esbuild.config.cjs", workspace);
  assertBuiltOutput(
    "dist-esbuild/esbuild-entry.js",
    "ESBUILD-INSTALLED-OK",
    "esbuild",
  );
}

function verifyRolldownBuild() {
  run("npx rolldown -c rolldown.config.mjs", workspace);
  assertBuiltOutput(
    "dist-rolldown/rolldown-entry.js",
    "ROLLDOWN-INSTALLED-OK",
    "rolldown",
  );
}

function verifyWebpackBuild() {
  run("npx webpack --config webpack.config.cjs", workspace);
  assertBuiltOutput(
    "dist-webpack/webpack-entry.js",
    "WEBPACK-INSTALLED-OK",
    "webpack",
  );
}

function verifyRspackBuild() {
  run("npx rspack build --config rspack.config.cjs", workspace);
  assertBuiltOutput(
    "dist-rspack/rspack-entry.js",
    "RSPACK-INSTALLED-OK",
    "rspack",
  );
}

function verifyFarmBuild() {
  run("node farm-build.mjs", workspace);
  const output = findSingleBuiltFile("dist-farm", "farm-entry");
  assertBuiltOutput(output, "FARM-INSTALLED-OK", "farm");
}

function verifyNextBuild() {
  run("npx next build --webpack", workspace);
  assertBuiltTreeContains(
    "dist-next",
    "NEXT-INSTALLED-OK",
    "next",
    "next-installed-ok",
  );
}

function verifyBunBuild() {
  if (!commandExists("bun")) {
    console.log("$ bun build skipped: bun executable is not available");
    return;
  }
  run("bun bun-build.mjs", workspace);
  const output = findSingleBuiltFile("dist-bun", "bun-entry");
  assertBuiltOutput(output, "BUN-INSTALLED-OK", "bun");
}

function assertBuiltTreeContains(directory, expected, label, original) {
  const rootDir = path.join(workspace, directory);
  assert(fs.existsSync(rootDir), `${label} must emit ${directory}`);
  let foundExpected = false;
  let foundOriginal = false;
  walk(rootDir, (file) => {
    if (!/\.(?:html|js|json)$/.test(file)) {
      return;
    }
    const emitted = fs.readFileSync(file, "utf8");
    foundExpected = foundExpected || emitted.includes(expected);
    foundOriginal = foundOriginal || emitted.includes(original);
  });
  assert(
    foundExpected,
    `${label} must emit the transformed marker ${expected}`,
  );
  assert(
    !foundOriginal,
    `${label} must not leave the original marker call in emitted assets`,
  );
}

function assertBuiltOutput(relative, expected, label) {
  const output = path.join(workspace, relative);
  assert(fs.existsSync(output), `${label} must emit ${relative}`);
  const emitted = fs.readFileSync(output, "utf8");
  assert(
    emitted.includes(expected),
    `${label} must emit the transformed marker ${expected}`,
  );
  assert(
    !/mark\(|installed-ok/.test(emitted),
    `${label} must not leave the original marker call in emitted JavaScript`,
  );
  assertConsoleOutput(
    `node ${relative}`,
    runNode([output], workspace, `node ${relative}`).stdout,
    expected,
  );
}

function findSingleBuiltFile(directory, prefix) {
  const rootDir = path.join(workspace, directory);
  assert(fs.existsSync(rootDir), `${directory} must exist`);
  const files: string[] = [];
  walk(rootDir, (file) => {
    if (file.endsWith(".js") && path.basename(file).startsWith(prefix)) {
      files.push(path.relative(workspace, file));
    }
  });
  assert(
    files.length === 1,
    `${directory} must contain one JavaScript output starting with ${prefix}, got ${files.join(", ")}`,
  );
  return files[0];
}

function walk(dir, visit) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file, visit);
    else visit(file);
  }
}

function commandExists(command) {
  const result = cp.spawnSync(command, ["--version"], {
    cwd: workspace,
    encoding: "utf8",
    stdio: ["ignore", "ignore", "ignore"],
    windowsHide: true,
  });
  return result.status === 0;
}

function assertConsoleOutput(command, stdout, expected) {
  const actual = stdout.trim();
  assert(
    actual === expected,
    `${command} must print ${JSON.stringify(expected)} to stdout, got ${JSON.stringify(actual)}`,
  );
}

function tarball(name) {
  const file = path.join(tarballs, `${name}.tgz`);
  assert(fs.existsSync(file), `${name}.tgz must exist`);
  return file;
}

function run(command, cwd) {
  console.log(`$ ${command}`);
  const result = cp.execSync(command, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      npm_config_cache: path.join(os.tmpdir(), "ttsc-npm-cache"),
    },
    maxBuffer: 1024 * 1024 * 64,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result) process.stdout.write(result);
  return { stdout: result };
}

function runNode(args, cwd, label) {
  console.log(`$ ${label ?? [process.execPath, ...args].join(" ")}`);
  const result = cp.spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 1024 * 1024 * 64,
    windowsHide: true,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  assert(result.status === 0, `node ${args.join(" ")} failed`);
  return result;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
