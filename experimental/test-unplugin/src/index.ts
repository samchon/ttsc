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
 * The globs `withTtsc`'s dedupe guard treats as naming every file with an
 * extension, so it declines to add its own rules beside them.
 *
 * Kept here rather than imported, because the point is to check our belief
 * against Turbopack rather than to restate it. The unit case
 * `case_next_adapter_does_not_double_register_across_globs` asserts this list
 * and the guard agree in both directions, so a spelling cannot be added to one
 * without the other.
 */
const TURBOPACK_PROJECT_WIDE_GLOBS = [
  "*.ts",
  "**/*.ts",
  "{**/,}*.ts",
  "*.tsx",
  "**/*.tsx",
  "*.{ts,tsx}",
  "{*.ts,*.tsx}",
  "**/*.{ts,tsx}",
  "**/{*.ts,*.tsx}",
  "**/**/*.{ts,tsx}",
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
        include: ["src", "pages", "turbopack-root-entry.ts"],
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
        include: ["next-env.d.ts", "pages", "src", "turbopack-root-entry.ts"],
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
  writeTurbopackRootEntry();
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
function writeTurbopackRootEntry() {
  fs.writeFileSync(
    path.join(workspace, "turbopack-root-entry.ts"),
    [
      'export const rootValue = mark("turbopack-root-ok");',
      "console.log(rootValue);",
      "",
    ].join("\n"),
    "utf8",
  );
  // A `.tsx` source as well, because the guard decides per extension and a Next
  // project is mostly `.tsx`. A glob recognised for `.ts` alone must still
  // leave the wrapper adding its own `*.tsx` rule, and only a build can say
  // whether that happened.
  fs.writeFileSync(
    path.join(workspace, "src", "turbopack-tsx-entry.tsx"),
    [
      'export const tsxValue = mark("turbopack-tsx-ok");',
      "console.log(tsxValue);",
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
      'import { rootValue } from "../turbopack-root-entry";',
      'import { tsxValue } from "../src/turbopack-tsx-entry";',
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
      '    if strings.HasSuffix(file, ".d.ts") || (!strings.HasSuffix(file, ".ts") && !strings.HasSuffix(file, ".tsx")) {',
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
    assertBuiltTreeContains(
      "dist-next",
      "NEXT-INSTALLED-OK",
      `next ${bundler}`,
      "next-installed-ok",
    );
  }
}

/**
 * Verify the dedupe guard's recognised set against the bundler that owns it.
 *
 * `withTtsc` skips registering its `*.ts` and `*.tsx` rules when a caller's own
 * rule already carries this loader for the same file set. Recognising a glob
 * that does _not_ in fact cover everything leaves the uncovered modules with no
 * ttsc rule at all — a build that succeeds with plugin-driven constructs
 * untransformed, which is samchon/ttsc#1310 and has already happened twice in
 * this wrapper.
 *
 * Every spelling is sound today, measured. What was missing is anything that
 * would notice it stopping: the recognised set is a contract with Turbopack's
 * matcher, and a Next.js upgrade is enough to break it (samchon/ttsc#1319). So
 * each glob is hand-wired the way a caller would, the guard is left to
 * recognise it and add nothing, and a real build has to show both a nested and
 * a root-level module transformed. A unit test cannot answer this, because it
 * would only ask our own matcher what our own matcher thinks.
 */
function verifyTurbopackRecognisedGlobs() {
  for (const glob of [
    ...TURBOPACK_PROJECT_WIDE_GLOBS,
    ...TURBOPACK_SCOPED_GLOBS,
  ]) {
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
        `        ${JSON.stringify(glob)}: {`,
        '          loaders: ["@ttsc/unplugin/turbopack"],',
        "        },",
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
    // The assertion is the same either way, and that is the point: whether the
    // guard recognised the caller's glob or added its own rules beside it, the
    // end state has to be that every TypeScript source was transformed. A
    // recognised glob that does not really cover the project fails here, and so
    // does a refused one the wrapper then failed to complete.
    for (const [marker, original, depth] of [
      ["NEXT-INSTALLED-OK", "next-installed-ok", "nested .ts"],
      ["TURBOPACK-ROOT-OK", "turbopack-root-ok", "root .ts"],
      ["TURBOPACK-TSX-OK", "turbopack-tsx-ok", "nested .tsx"],
    ]) {
      assertBuiltTreeContains(
        "dist-next",
        marker,
        `next --turbopack glob ${glob} (${depth})`,
        original,
      );
    }
  }
  writeNextConfig();
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
    path.join(workspace, "bun-runtime-preload.mjs"),
    [
      // Runtime counterpart of the Bun.build adapter: register the transform on
      // Bun's module loader so `bun run` applies it on import. Registered once
      // via the adapter with the harness's explicit (non-default) tsconfig —
      // `@ttsc/unplugin/bun-register` is the shipped one-liner wrapper for this,
      // covered by its own unit test and the entrypoint resolution check.
      'import ttsc from "@ttsc/unplugin/bun";',
      'globalThis.Bun.plugin(ttsc({ project: "tsconfig.unplugin.json" }));',
      "",
    ].join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(workspace, "bunfig.toml"),
    ['preload = ["./bun-runtime-preload.mjs"]', ""].join("\n"),
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
