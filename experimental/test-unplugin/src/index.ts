import cp from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
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
  "@farmfe/core@1.7.11",
  // Rspack 2.0.1+ crashes on Windows ARM64 during native binding teardown.
  "@rspack/cli@2.0.0",
  "@rspack/core@2.0.0",
  "@types/react@18.3.29",
  "@types/react-dom@18.3.7",
  "esbuild@0.25.12",
  "next@16.3.0",
  "rolldown@1.2.6",
  "rollup@4.60.4",
  "react@18.3.1",
  "react-dom@18.3.1",
  // Native TypeScript 7 ships no classic JS compiler API, which Next's built-in
  // TypeScript integration loads at build start. ttsc instead receives the
  // workspace `tsc` binary through TTSC_TSGO_BINARY (set in `run`), so the
  // consumer only needs the legacy compiler here to satisfy Next.
  "typescript@6.0.3",
  "vite@7.3.6",
  "webpack@5.107.1",
  "webpack-cli@7.2.3",
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

/**
 * Globs the guard must refuse, driven through a real build for the same reason
 * the recognised set is.
 *
 * `{src/,}*.ts` is the one that matters. Set semantics say it offers a bare
 * `*.ts` and therefore covers the project, and on that reasoning the guard once
 * recognised it — but Turbopack matches **nothing** with it, so suppressing
 * this wrapper's rules in its favour transformed no file at all. Refusing it
 * means the wrapper adds its own rules and every source is still transformed,
 * which is what these builds assert (samchon/ttsc#1319).
 */
const TURBOPACK_SCOPED_GLOBS = ["{src/,}*.ts", "src/**/*.ts"];

const requireFromRoot = createRequire(path.join(root, "package.json"));

/**
 * Absolute path to the workspace's native `tsc` binary, forwarded to ttsc via
 * TTSC_TSGO_BINARY (see `run`). This lets the experimental consumer omit the
 * native `typescript` package, which Next would otherwise discover and fail on
 * (its TypeScript integration cannot load native TypeScript 7).
 */
function resolveTscBinary() {
  const packageJson = requireFromRoot.resolve("typescript/package.json");
  const platformPackageJson = createRequire(packageJson).resolve(
    `@typescript/typescript-${process.platform}-${process.arch}/package.json`,
  );
  return path.join(
    path.dirname(platformPackageJson),
    "lib",
    process.platform === "win32" ? "tsc.exe" : "tsc",
  );
}
const TSC_BINARY = resolveTscBinary();

test_unplugin_package_e2e();

/** Run the complete packed-package adapter contract in one consumer install. */
export function test_unplugin_package_e2e() {
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
  verifyTurbopackRecognisedGlobs();
  verifyBunBuild();
  verifyBunRuntime();
  console.log("Success");
}

function prepareCurrentTarballs() {
  run("pnpm run build:current", root, { TTSC_BUILD_SCOPE: "experimental" });

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
        include: ["src", "pages", "turbopack-root-entry.*"],
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
        include: ["next-env.d.ts", "pages", "src", "turbopack-root-entry.*"],
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
  writeBunRegisterOptimizerEntry();
  writeSource("webpack-entry.ts", "webpack-installed-ok");
  writeSource("rspack-entry.ts", "rspack-installed-ok");
  writeSource("farm-entry.ts", "farm-installed-ok");
  writeSource("next-entry.ts", "next-installed-ok");
  writeSource("bun-entry.ts", "bun-installed-ok");
  writeTurbopackRootEntry();
  writeTurbopackGlobProbeLoader();
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

/** Prove a packed bare runtime-registration import survives optimization. */
function writeBunRegisterOptimizerEntry() {
  fs.writeFileSync(
    path.join(workspace, "src", "bun-register-optimizer-entry.ts"),
    [
      'import "@ttsc/unplugin/bun-register";',
      "",
      "const registrations = (globalThis as { __ttscBunRegistrations?: number })",
      "  .__ttscBunRegistrations;",
      "if (registrations !== 1) {",
      "  throw new Error(`expected one Bun registration, received ${registrations}`);",
      "}",
      'console.log("BUN-REGISTER-OPTIMIZER-OK");',
      "",
    ].join("\n"),
    "utf8",
  );
}

/**
 * A source at the project root, which `src/next-entry.ts` cannot stand in for.
 *
 * The dedupe guard skips the wrapper's own rules when a caller's glob already
 * names every file with the extension, and whether a glob does that is
 * Turbopack's answer, not ours. A `**` + `/` prefix that required at least one
 * segment would cover `src/` and miss this file, which is how a recognised
 * spelling turns into samchon/ttsc#1310: no rule, no transform, green build.
 * `middleware.ts` and `instrumentation.ts` are the real files at this depth.
 */
function turbopackEntrySource(
  variable: string,
  marker: string,
  extension: string,
): string {
  // The fixture transform is source-to-source and does not rewrite ESM into
  // CommonJS. Keep `.cts` inputs CommonJS-compatible so this test isolates
  // extension routing instead of assuming a separate module transform.
  return [
    `${extension === "cts" ? "" : "export "}const ${variable} = mark(${JSON.stringify(marker)});`,
    `console.log(${variable});`,
    "",
  ].join("\n");
}

function writeTurbopackRootEntry() {
  fs.writeFileSync(
    path.join(workspace, "turbopack-root-entry.ts"),
    turbopackEntrySource("rootValue", "turbopack-root-ok", "ts"),
    "utf8",
  );
  // A `.tsx` source as well, because the guard decides per extension and a Next
  // project is mostly `.tsx`. A glob recognised for `.ts` alone must still
  // leave the wrapper adding its own `*.tsx` rule, and only a build can say
  // whether that happened.
  fs.writeFileSync(
    path.join(workspace, "src", "turbopack-tsx-entry.tsx"),
    turbopackEntrySource("tsxValue", "turbopack-tsx-ok", "tsx"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(workspace, "src", "turbopack-mts-entry.mts"),
    turbopackEntrySource("mtsValue", "turbopack-mts-ok", "mts"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(workspace, "src", "turbopack-cts-entry.cts"),
    turbopackEntrySource("ctsValue", "turbopack-cts-ok", "cts"),
    "utf8",
  );
  for (const [extension, marker] of [
    ["tsx", "turbopack-root-tsx-ok"],
    ["mts", "turbopack-root-mts-ok"],
    ["cts", "turbopack-root-cts-ok"],
  ]) {
    fs.writeFileSync(
      path.join(workspace, `turbopack-root-entry.${extension}`),
      turbopackEntrySource("rootValue", marker, extension),
      "utf8",
    );
  }
  const deepDirectory = path.join(workspace, "src", "deep", "nested");
  fs.mkdirSync(deepDirectory, { recursive: true });
  for (const extension of ["ts", "tsx", "mts", "cts"]) {
    fs.writeFileSync(
      path.join(deepDirectory, `turbopack-deep-entry.${extension}`),
      turbopackEntrySource(
        "deepValue",
        `turbopack-deep-${extension}-ok`,
        extension,
      ),
      "utf8",
    );
  }
}

/** Write the lightweight loader that records every real Turbopack glob match. */
function writeTurbopackGlobProbeLoader() {
  fs.writeFileSync(
    path.join(workspace, "turbopack-glob-probe.cjs"),
    [
      'const crypto = require("node:crypto");',
      'const fs = require("node:fs");',
      'const path = require("node:path");',
      "",
      "module.exports = function turbopackGlobProbe(source) {",
      "  const options = this.getOptions();",
      "  const directory = path.join(options.outputDirectory, String(options.id));",
      "  fs.mkdirSync(directory, { recursive: true });",
      '  const key = crypto.createHash("sha256").update(this.resourcePath).digest("hex");',
      '  fs.writeFileSync(path.join(directory, key), this.resourcePath, "utf8");',
      "  return source;",
      "};",
      "",
    ].join("\n"),
    "utf8",
  );
}

function writeNextPage() {
  fs.mkdirSync(path.join(workspace, "pages"), { recursive: true });
  fs.writeFileSync(
    path.join(workspace, "pages", "index.js"),
    [
      'import { value } from "../src/next-entry";',
      'import { rootValue } from "../turbopack-root-entry.ts";',
      'import { tsxValue } from "../src/turbopack-tsx-entry";',
      'import "../src/turbopack-mts-entry.mts";',
      'import "../src/turbopack-cts-entry.cts";',
      'import "../turbopack-root-entry.tsx";',
      'import "../turbopack-root-entry.mts";',
      'import "../turbopack-root-entry.cts";',
      'import "../src/deep/nested/turbopack-deep-entry.ts";',
      'import "../src/deep/nested/turbopack-deep-entry.tsx";',
      'import "../src/deep/nested/turbopack-deep-entry.mts";',
      'import "../src/deep/nested/turbopack-deep-entry.cts";',
      "",
      "export default function Page() {",
      "  return value + rootValue + tsxValue;",
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
      "module.exports = function createUnpluginTransform(context) {",
      "  return {",
      '    name: "experimental-unplugin-transform",',
      '    source: path.resolve(context.dirname, "unplugin-transform-go"),',
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
      // Walk the project rather than `src` alone. A real ttsc host returns an
      // entry for every file in the program, so a fixture that skipped the
      // project root made a root-level source look absent from the program and
      // reported it as such — the fixture's answer, not the product's. The
      // Turbopack glob verification needs a root-level source to be real
      // (samchon/ttsc#1319).
      // Derived rather than listed. Every build output this harness writes is a
      // `dist-` directory, so a new adapter verification cannot silently add
      // its emitted `.ts` to the program by landing somewhere unlisted.
      '  skipDirs := map[string]bool{"node_modules": true, ".next": true, ".git": true, ".ttsc": true}',
      "  err := filepath.WalkDir(root, func(file string, entry fs.DirEntry, err error) error {",
      // A vanished entry is not a reason to fail a build. The project root is a
      // live tree while Next is writing to it, and returning the error here
      // aborted the whole transform; walking `src` alone never saw that.
      "    if err != nil { if os.IsNotExist(err) { return nil }; return err }",
      '    if entry.IsDir() { if skipDirs[entry.Name()] || strings.HasPrefix(entry.Name(), "dist-") { return filepath.SkipDir }; return nil }',
      "    base := filepath.Base(file)",
      '    declaration := strings.HasSuffix(base, ".d.ts") || strings.HasSuffix(base, ".d.mts") || strings.HasSuffix(base, ".d.cts") || (strings.HasSuffix(base, ".ts") && strings.Contains(base, ".d."))',
      '    isSource := strings.HasSuffix(file, ".ts") || strings.HasSuffix(file, ".tsx") || strings.HasSuffix(file, ".mts") || strings.HasSuffix(file, ".cts")',
      "    if declaration || !isSource {",
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
      "    turbopack: {",
      "      rules: {",
      '        "*.ts": [{ condition: "browser", type: "typescript" }],',
      "      },",
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
      "  entryPoints: {",
      '    "esbuild-entry": "src/esbuild-entry.ts",',
      '    "bun-register-optimizer-entry": "src/bun-register-optimizer-entry.ts",',
      "  },",
      "  bundle: true,",
      '  external: ["ttsc", "unplugin"],',
      '  format: "esm",',
      "  banner: {",
      "    js:",
      '      "globalThis.__ttscBunRegistrations = 0; globalThis.Bun = { plugin() { globalThis.__ttscBunRegistrations += 1; } };",',
      "  },",
      '  outdir: "dist-esbuild",',
      '  platform: "node",',
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
  const { stdout } = run(
    "node dist-esbuild/bun-register-optimizer-entry.js",
    workspace,
  );
  assert(
    stdout.includes("BUN-REGISTER-OPTIMIZER-OK"),
    "esbuild must retain the packed bun-register bare import and execute it exactly once",
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
  // Both of Next's bundlers, because `withTtsc` claims both. The webpack half
  // was the only one checked for a long time, and forcing `--webpack` here is
  // what let the Turbopack half ship doing nothing at all: the build succeeded
  // and the output was simply untransformed (samchon/ttsc#1310). The assertion
  // is the same for each, and it is the one that fails when the transform did
  // not run, since it requires the transformed marker and refuses the original.
  for (const bundler of ["--webpack", "--turbopack"]) {
    fs.rmSync(path.join(workspace, "dist-next"), {
      force: true,
      recursive: true,
    });
    run(`npx next build ${bundler}`, workspace);
    for (const [marker, original, extension] of [
      ["NEXT-INSTALLED-OK", "next-installed-ok", ".ts"],
      ["TURBOPACK-TSX-OK", "turbopack-tsx-ok", ".tsx"],
      ["TURBOPACK-MTS-OK", "turbopack-mts-ok", ".mts"],
      ["TURBOPACK-CTS-OK", "turbopack-cts-ok", ".cts"],
    ]) {
      assertBuiltTreeContains(
        "dist-next",
        marker,
        `next ${bundler} (${extension})`,
        original,
      );
    }
  }
}

/**
 * Verify the dedupe guard's recognised set against the bundler that owns it.
 *
 * `withTtsc` skips an automatic source rule when a caller's own rule already
 * carries this loader for the same file set. Recognising a glob that does _not_
 * in fact cover everything leaves the uncovered modules with no ttsc rule at
 * all — a build that succeeds with plugin-driven constructs untransformed,
 * which is samchon/ttsc#1310 and has already happened twice in this wrapper.
 *
 * Every spelling is sound today, measured. What was missing is anything that
 * would notice it stopping: the recognised set is a contract with Turbopack's
 * matcher, and a Next.js upgrade is enough to break it (samchon/ttsc#1319). One
 * lightweight probe loader is registered under every spelling in one real build
 * and records the exact resources each rule matched. Transformation remains the
 * preceding build's responsibility: overlapping probe rules compose in
 * Turbopack and can shadow the wrapper's one automatic rule, so asking this
 * measurement build for transformed output would make the instrument change the
 * answer. A unit test cannot answer this because it would ask our matcher what
 * our matcher thinks.
 */
function verifyTurbopackRecognisedGlobs() {
  const coverage = installedTurbopackProjectWideGlobCoverage();
  const projectWideGlobs = coverage.map(([glob]) => glob);
  const globs = [...projectWideGlobs, ...TURBOPACK_SCOPED_GLOBS];
  const probeDirectory = path.join(
    experimentRoot,
    ".tmp",
    "turbopack-glob-probes",
  );
  fs.rmSync(probeDirectory, { force: true, recursive: true });
  fs.mkdirSync(probeDirectory, { recursive: true });
  const probeLoader = path.join(workspace, "turbopack-glob-probe.cjs");
  const rules = globs.flatMap((glob, index) => [
    `        ${JSON.stringify(glob)}: {`,
    "          loaders: [{",
    `            loader: ${JSON.stringify(probeLoader)},`,
    `            options: { id: ${JSON.stringify(String(index))}, outputDirectory: ${JSON.stringify(probeDirectory)} },`,
    "          }],",
    "        },",
  ]);
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
      "    turbopack: {",
      "      rules: {",
      ...rules,
      "      },",
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
  fs.rmSync(path.join(workspace, "dist-next"), {
    force: true,
    recursive: true,
  });
  run("npx next build --turbopack", workspace);

  const sourcePaths = new Map([
    [
      "ts",
      [
        path.join(workspace, "turbopack-root-entry.ts"),
        path.join(workspace, "src", "next-entry.ts"),
        path.join(
          workspace,
          "src",
          "deep",
          "nested",
          "turbopack-deep-entry.ts",
        ),
      ],
    ],
    [
      "tsx",
      [
        path.join(workspace, "turbopack-root-entry.tsx"),
        path.join(workspace, "src", "turbopack-tsx-entry.tsx"),
        path.join(
          workspace,
          "src",
          "deep",
          "nested",
          "turbopack-deep-entry.tsx",
        ),
      ],
    ],
    [
      "mts",
      [
        path.join(workspace, "turbopack-root-entry.mts"),
        path.join(workspace, "src", "turbopack-mts-entry.mts"),
        path.join(
          workspace,
          "src",
          "deep",
          "nested",
          "turbopack-deep-entry.mts",
        ),
      ],
    ],
    [
      "cts",
      [
        path.join(workspace, "turbopack-root-entry.cts"),
        path.join(workspace, "src", "turbopack-cts-entry.cts"),
        path.join(
          workspace,
          "src",
          "deep",
          "nested",
          "turbopack-deep-entry.cts",
        ),
      ],
    ],
  ]);
  const dedicatedSources = [...sourcePaths.values()].flat();
  const comparable = (file) => {
    const resolved = path.resolve(file);
    return process.platform === "win32" ? resolved.toLowerCase() : resolved;
  };
  const probeMatches = (index) => {
    const directory = path.join(probeDirectory, String(index));
    if (!fs.existsSync(directory)) return new Set();
    return new Set(
      fs
        .readdirSync(directory)
        .map((file) => fs.readFileSync(path.join(directory, file), "utf8"))
        .map(comparable),
    );
  };
  const mismatches = [];
  for (const [index, [glob, extensions]] of coverage.entries()) {
    const expected = extensions.flatMap(
      (extension) => sourcePaths.get(extension) ?? [],
    );
    const matches = probeMatches(index);
    const actual = dedicatedSources
      .filter((file) => matches.has(comparable(file)))
      .map(comparable)
      .sort();
    const wanted = expected.map(comparable).sort();
    if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
      mismatches.push(
        `${glob} expected ${JSON.stringify(wanted)} but matched ${JSON.stringify(actual)}`,
      );
    }
  }
  for (const [offset, glob] of TURBOPACK_SCOPED_GLOBS.entries()) {
    const matches = probeMatches(projectWideGlobs.length + offset);
    const tsSources = sourcePaths.get("ts") ?? [];
    if (tsSources.every((file) => matches.has(comparable(file)))) {
      mismatches.push(
        `${glob} must remain refused because it covers every project-wide .ts source`,
      );
    }
  }
  assert(
    mismatches.length === 0,
    `Turbopack glob coverage mismatches:\n${mismatches.join("\n")}`,
  );
  writeNextConfig();
}

/** Read the immutable allowlist from the installed package under test. */
function installedTurbopackProjectWideGlobCoverage() {
  const requireFromWorkspace = createRequire(
    path.join(workspace, "package.json"),
  );
  const nextModule = requireFromWorkspace("@ttsc/unplugin/next");
  const coverage = nextModule.TURBOPACK_PROJECT_WIDE_GLOB_COVERAGE;
  assert(
    Array.isArray(coverage) && coverage.length > 0,
    "the installed Next adapter must export its measured Turbopack glob coverage",
  );
  return coverage;
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

// Bun RUNTIME preload smoke (typia #1534): `@ttsc/unplugin/bun-register`
// registered via a `bunfig.toml` preload must transform source on import so
// `bun run entry.ts` executes transformed code — no bundling step. Written
// after verifyBunBuild so the bunfig preload cannot affect the earlier build.
function verifyBunRuntime() {
  if (!commandExists("bun")) {
    console.log("$ bun run skipped: bun executable is not available");
    return;
  }
  fs.writeFileSync(
    path.join(workspace, "src", "bun-runtime-entry.ts"),
    [
      // `mark` is only declared (globals.d.ts); if the preload transform does
      // not run, `mark(...)` survives and Bun throws "mark is not defined".
      'export const value = mark("bun-runtime-ok");',
      "console.log(value);",
      "",
    ].join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(workspace, "bunfig.toml"),
    ['preload = ["@ttsc/unplugin/bun-register"]', ""].join("\n"),
    "utf8",
  );
  const { stdout } = run("bun run src/bun-runtime-entry.ts", workspace);
  assert(
    stdout.includes("BUN-RUNTIME-OK"),
    "bun runtime preload must transform mark() on import (expected BUN-RUNTIME-OK in stdout)",
  );
  assert(
    !stdout.includes("bun-runtime-ok"),
    "bun runtime preload must not leave the original marker string",
  );
}

function assertBuiltTreeContains(directory, expected, label, original) {
  const rootDir = path.join(workspace, directory);
  assert(fs.existsSync(rootDir), `${label} must emit ${directory}`);
  let foundExpected = false;
  const originalFiles = [];
  walk(rootDir, (file) => {
    if (!/\.(?:html|js|json)$/.test(file)) {
      return;
    }
    const emitted = fs.readFileSync(file, "utf8");
    foundExpected = foundExpected || emitted.includes(expected);
    if (emitted.includes(original)) {
      originalFiles.push(path.relative(workspace, file));
    }
  });
  assert(
    foundExpected,
    `${label} must emit the transformed marker ${expected}`,
  );
  assert(
    originalFiles.length === 0,
    `${label} must not leave the original marker call in emitted assets: ${originalFiles.join(", ")}`,
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

function run(command, cwd, extraEnv = {}) {
  console.log(`$ ${command}`);
  try {
    const result = cp.execSync(command, {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        ...extraEnv,
        npm_config_cache: path.join(os.tmpdir(), "ttsc-npm-cache"),
        // ttsc resolves the native `tsc` binary from here, so the consumer need
        // not install the native `typescript` package (Next cannot load it).
        TTSC_TSGO_BINARY: TSC_BINARY,
      },
      maxBuffer: 1024 * 1024 * 64,
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (result) process.stdout.write(result);
    return { stdout: result };
  } catch (error) {
    if (error.stdout) process.stdout.write(error.stdout);
    if (error.stderr) process.stderr.write(error.stderr);
    throw error;
  }
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
