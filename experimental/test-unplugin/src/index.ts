import { test_packed_installed_compiler } from "./contracts/builds/test_packed_installed_compiler.mjs";
import { test_packed_entrypoints } from "./contracts/builds/test_packed_entrypoints.mjs";
import { test_packed_vite } from "./contracts/builds/test_packed_vite.mjs";
import { test_packed_rollup } from "./contracts/builds/test_packed_rollup.mjs";
import { test_packed_esbuild } from "./contracts/builds/test_packed_esbuild.mjs";
import { test_packed_rolldown } from "./contracts/builds/test_packed_rolldown.mjs";
import { test_packed_webpack } from "./contracts/builds/test_packed_webpack.mjs";
import { test_packed_rspack } from "./contracts/builds/test_packed_rspack.mjs";
import { test_packed_farm } from "./contracts/builds/test_packed_farm.mjs";
import { test_packed_next } from "./contracts/builds/test_packed_next.mjs";
import { test_packed_turbopack_globs } from "./contracts/builds/test_packed_turbopack_globs.mjs";
import { test_packed_bun_build } from "./contracts/builds/test_packed_bun_build.mjs";
import { test_packed_bun_runtime } from "./contracts/builds/test_packed_bun_runtime.mjs";

import cp from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const experimentRoot = path.resolve(import.meta.dirname, "..");
const root = path.resolve(experimentRoot, "../..");
const tarballs = path.join(root, "experimental", "tarballs");
const workspace = path.join(experimentRoot, ".tmp", "project");
const dependencyStore = path.join(experimentRoot, ".tmp", "install");
// The consumer is rebuilt each run; its content-keyed plugin cache survives
// beside it and joins the CI archive when a shared test root is supplied.
const pluginCache = path.resolve(
  process.env.TTSC_CACHE_DIR ??
    process.env.TTSC_TEST_CACHE_DIR ??
    path.join(experimentRoot, ".cache", "ttsc"),
);
const skipPack = process.argv.includes("--skip-pack");
const platformKey = `${process.platform}-${process.arch}`;
const platformTarball = `ttsc-${platformKey}`;
const installedPlugins = ["banner", "lint", "paths", "strip"];
const registryDependencies = [
  "@farmfe/core@1.7.11",
  "@react-router/dev@8.4.0",
  "react-router@8.4.0",
  "vite8@npm:vite@8.3.0",
  // Rspack 2.0.1+ crashes on Windows ARM64 during native binding teardown.
  "@rspack/cli@2.0.0",
  "@rspack/core@2.0.0",
  "@types/react@19.3.0",
  "@types/react-dom@19.3.0",
  "esbuild@0.28.2",
  "next@16.3.0",
  "rolldown@1.2.6",
  "rollup@4.60.4",
  "react@19.2.7",
  "react-dom@19.2.7",
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
  "turbopack",
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
const { runIndependent } = requireFromRoot(
  "./experimental/test-unplugin/src/contracts/run-independent.cjs",
);

/** Select a consumer's direct dependencies from one complete npm installation. */
function consumerDependencies(
  installed: Record<string, string>,
  specifiers: string[],
): Record<string, string> {
  return Object.fromEntries(
    specifiers.map((specifier) => {
      const at = specifier.indexOf("@", specifier.startsWith("@") ? 1 : 0);
      const name = at === -1 ? specifier : specifier.slice(0, at);
      if (typeof installed[name] !== "string")
        throw new Error(`shared installation is missing dependency ${name}`);
      return [name, installed[name]];
    }),
  );
}

// Each phase owns its output directory. The Next builds and matcher probe share
// next.config.mjs/dist-next and therefore remain one serial phase.
const buildPhases = {
  installed: verifyInstalledCompilerContracts,
  entrypoints: verifyEntrypoints,
  vite: verifyViteBuild,
  rollup: verifyRollupBuild,
  rolldown: verifyRolldownBuild,
  esbuild: verifyEsbuildBuild,
  webpack: verifyWebpackBuild,
  rspack: verifyRspackBuild,
  farm: verifyFarmBuild,
  next: async () => {
    const failed = await runIndependent(
      [verifyNextBuild, verifyTurbopackRecognisedGlobs],
      async (verify) => {
        await verify();
        return 0;
      },
    );
    if (failed.length) throw new Error("Next build or matcher contract failed");
  },
  bun: verifyBunBuild,
  "bun-runtime": verifyBunRuntime,
};

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

// A failure ends the process through its exit code rather than as an uncaught
// exception, which exits at once: macOS takes writes to a pipe
// asynchronously, so the output `run` writes for a failed command just before
// it throws, the host matrix's failure detail among it, was cut short there.
try {
  const phase = process.argv
    .find((argument) => argument.startsWith("--validation-phase="))
    ?.slice("--validation-phase=".length);
  if (phase === undefined) await test_unplugin_package_e2e();
  else {
    assert(Object.hasOwn(buildPhases, phase), `Unknown build phase: ${phase}`);
    await buildPhases[phase]();
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

/** Run the complete packed-package adapter contract in one consumer install. */
export async function test_unplugin_package_e2e() {
  assert(
    commandExists("bun"),
    "The complete adapter contract requires Bun on PATH (CI pins its version).",
  );
  if (!skipPack) prepareCurrentTarballs();
  prepareWorkspace();
  installTarballs();
  const failed = await runIndependent(
    Object.keys(buildPhases).filter(
      (phase) => phase !== "bun" && phase !== "bun-runtime",
    ),
    executeBuildPhase,
    Number(process.env.TTSC_HOST_WORKERS ?? 1),
  );
  // Finish the host lifecycle sweep even when a standalone build failed. It
  // owns the full worker budget after basic builds, avoiding nested fan-out.
  try {
    verifyEcosystemContracts();
  } catch (error) {
    console.error(error);
    failed.push("ecosystem");
  }
  // Runtime preload writes both a source and the ancestor bunfig.toml. Keep
  // the original order so no build or host observes those changing inputs.
  failed.push(
    ...(await runIndependent(["bun", "bun-runtime"], executeBuildPhase)),
  );
  assert(failed.length === 0, `Failed packed contracts: ${failed.join(", ")}`);
  console.log("Success");
}

function executeBuildPhase(phase: string): Promise<number> {
  return new Promise((resolve) => {
    const child = cp.spawn(
      process.execPath,
      [
        ...process.execArgv,
        path.join(experimentRoot, "src", "index.ts"),
        `--validation-phase=${phase}`,
      ],
      {
        cwd: experimentRoot,
        env: process.env,
        stdio: "inherit",
        windowsHide: true,
      },
    );
    child.on("error", (error) => console.error(error));
    child.on("close", (code) => resolve(code ?? 1));
  });
}

function prepareCurrentTarballs() {
  if (process.env.TTSC_UNPLUGIN_SKIP_BUILD !== "1")
    run("pnpm run build", root);

  fs.mkdirSync(tarballs, { recursive: true });
  for (const name of [
    "ttsc",
    platformTarball,
    "unplugin",
    ...installedPlugins,
  ]) {
    fs.rmSync(path.join(tarballs, `${name}.tgz`), { force: true });
  }

  packPackage("ttsc", "ttsc");
  packPackage(platformTarball, platformTarball);
  packPackage("unplugin", "unplugin");
  for (const name of installedPlugins) packPackage(name, name);
}

function packPackage(packageDirName, tarballName) {
  const packageDir = path.join(root, "packages", packageDirName);
  assert(fs.existsSync(packageDir), `${packageDirName} package must exist`);

  // Straight into the tarball directory, as the workflows pack: a
  // tarball packed into the package directory outlives the run there.
  const output = path.join(tarballs, `${tarballName}.tgz`);
  run(`pnpm pack --out ${JSON.stringify(output)}`, packageDir);
  assert(
    fs.existsSync(output),
    `${packageDirName} package tarball must be created`,
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
  fs.cpSync(
    path.join(experimentRoot, "assets", "transform"),
    path.join(workspace, "unplugin-transform-go"),
    { recursive: true },
  );
  // The host matrix's second plugin: a linked contributor to ttsc's utility
  // host, so the compile goes through TypeScript-Go's program and the envelope
  // carries the compiler's verdict and graph.
  fs.writeFileSync(
    path.join(workspace, "unplugin-linked.cjs"),
    [
      'const path = require("node:path");',
      "",
      "module.exports = function createUnpluginLinked(context) {",
      "  return {",
      '    name: "experimental-unplugin-linked",',
      '    source: path.resolve(context.dirname, "unplugin-linked-go", "contract"),',
      "  };",
      "};",
      "",
    ].join("\n"),
    "utf8",
  );
  fs.cpSync(
    path.join(experimentRoot, "assets", "linked"),
    path.join(workspace, "unplugin-linked-go"),
    { recursive: true },
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
      `      root: ${JSON.stringify(path.dirname(workspace))},`,
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
  fs.mkdirSync(dependencyStore, { recursive: true });
  fs.writeFileSync(
    path.join(dependencyStore, "package.json"),
    JSON.stringify({ private: true, name: "ttsc-validation-dependencies" }),
  );
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
    "typescript-native@npm:typescript@7.0.2",
    tarball("ttsc"),
    tarball(platformTarball),
    tarball("unplugin"),
    ...installedPlugins.map(tarball),
  ].join(" ");
  run(command, dependencyStore);
  const installed = JSON.parse(
    fs.readFileSync(path.join(dependencyStore, "package.json"), "utf8"),
  ).dependencies;
  const manifestPath = path.join(workspace, "package.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  // The store supplies both scenarios, but automatic plugin discovery reads
  // this consumer's direct dependencies. Preserve its original declarations.
  manifest.dependencies = consumerDependencies(installed, [
    "ttsc",
    `@ttsc/${platformKey}`,
    "@ttsc/unplugin",
    ...registryDependencies,
  ]);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  fs.symlinkSync(
    path.join(dependencyStore, "node_modules"),
    path.join(workspace, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
}

/** Preserve the complete shipped-compiler contract in this consumer install. */
function verifyInstalledCompilerContracts() {
  return test_packed_installed_compiler({ workspace, root, experimentRoot, pluginCache, assert });
}

function verifyEntrypoints() {
  return test_packed_entrypoints({ workspace, adapterEntrypoints, run });
}

function verifyEcosystemContracts() {
  fs.cpSync(
    path.join(experimentRoot, "src", "contracts"),
    path.join(workspace, "contracts"),
    { recursive: true },
  );
  run("node contracts/index.mjs", workspace, {}, { inheritOutput: true });
}

function verifyViteBuild() {
  return test_packed_vite({ workspace, run, assertBuiltOutput });
}

function verifyRollupBuild() {
  return test_packed_rollup({ workspace, run, assertBuiltOutput });
}

function verifyEsbuildBuild() {
  return test_packed_esbuild({ workspace, run, assertBuiltOutput, assert });
}

function verifyRolldownBuild() {
  return test_packed_rolldown({ workspace, run, assertBuiltOutput });
}

function verifyWebpackBuild() {
  return test_packed_webpack({ workspace, run, assertBuiltOutput });
}

function verifyRspackBuild() {
  return test_packed_rspack({ workspace, run, assertBuiltOutput });
}

function verifyFarmBuild() {
  return test_packed_farm({ workspace, run, assertBuiltOutput, findSingleBuiltFile });
}

function verifyNextBuild() {
  return test_packed_next({ workspace, runIndependent, run, assertBuiltTreeContains, assert });
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
  return test_packed_turbopack_globs({ workspace, experimentRoot, TURBOPACK_SCOPED_GLOBS, run, installedTurbopackProjectWideGlobCoverage, writeNextConfig, assert });
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
  return test_packed_bun_build({ workspace, run, assertBuiltOutput, findSingleBuiltFile });
}

// Bun RUNTIME preload smoke (typia #1534): `@ttsc/unplugin/bun-register`
// registered via a `bunfig.toml` preload must transform source on import so
// `bun run entry.ts` executes transformed code — no bundling step. Written
// after verifyBunBuild so the bunfig preload cannot affect the earlier build.
function verifyBunRuntime() {
  return test_packed_bun_runtime({ workspace, run, assert });
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
    cwd: root,
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

function run(command, cwd, extraEnv = {}, options = { inheritOutput: false }) {
  console.log(`$ ${command}`);
  try {
    const result = cp.execSync(command, {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        ...extraEnv,
        npm_config_cache:
          process.env.npm_config_cache ||
          path.join(os.tmpdir(), "ttsc-npm-cache"),
        // ttsc resolves the native `tsc` binary from here, so the consumer need
        // not install the native `typescript` package (Next cannot load it).
        TTSC_TSGO_BINARY: TSC_BINARY,
        TTSC_CACHE_DIR: pluginCache,
      },
      maxBuffer: 1024 * 1024 * 64,
      stdio: options.inheritOutput ? "inherit" : ["ignore", "pipe", "pipe"],
    });
    if (result) process.stdout.write(result);
    return { stdout: result ?? "" };
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
