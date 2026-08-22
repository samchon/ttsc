import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Pack `@ttsc/unplugin` exactly as it would be published and return the packed
 * `package.json`.
 *
 * `pnpm pack` is offline and deterministic, and it rewrites `workspace:^` to
 * the concrete caret range a real consumer's package manager sees — the
 * published dependency contract. Reading that manifest (rather than the source
 * one) is what proves the contract a clean install would receive, without a
 * network install.
 */
interface PackedUnpluginPackage {
  manifest: Record<string, any>;
  packageRoot: string;
}

function packUnpluginPackage(): PackedUnpluginPackage {
  const unpluginDir = path.join(
    TestProject.WORKSPACE_ROOT,
    "packages",
    "unplugin",
  );
  const dest = TestProject.tmpdir("ttsc-unplugin-pack-");
  const packArgs = ["pack", "--pack-destination", dest];
  const pack = spawnSync(
    process.platform === "win32" ? "cmd.exe" : "pnpm",
    process.platform === "win32"
      ? ["/d", "/s", "/c", "pnpm", ...packArgs]
      : packArgs,
    {
      cwd: unpluginDir,
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(pack.status, 0, `pnpm pack failed:\n${pack.stderr}`);

  const tarball = fs.readdirSync(dest).find((name) => name.endsWith(".tgz"));
  assert.ok(tarball, "pnpm pack produced no tarball");

  // Extract through the platform tar (bsdtar on Windows, GNU tar elsewhere).
  // Run with `cwd: dest` and a relative tarball name so a Windows drive-letter
  // colon is never mistaken for a remote `host:path` spec by GNU tar.
  const extract = path.join(dest, "extract");
  fs.mkdirSync(extract);
  const unpack = spawnSync("tar", ["-xzf", tarball, "-C", "extract"], {
    cwd: dest,
    encoding: "utf8",
  });
  assert.equal(unpack.status, 0, `tar extraction failed:\n${unpack.stderr}`);
  const packageRoot = path.join(extract, "package");
  return {
    manifest: JSON.parse(
      fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"),
    ),
    packageRoot,
  };
}

function readPackedManifest(): Record<string, any> {
  return packUnpluginPackage().manifest;
}

/**
 * Asserts the published `@ttsc/unplugin` manifest declares its external `ttsc`
 * host in the runtime dependency contract.
 *
 * The package imports `ttsc` at runtime but the Rollup build leaves it
 * external. With `ttsc` declared only under `devDependencies`, a clean install
 * succeeded yet the first import failed with `Cannot find module 'ttsc'`. The
 * host must be a required `peerDependency` so a package manager installs,
 * validates, or warns about it — while staying external (never a bundled second
 * compiler copy).
 *
 * 1. Pack the package as it would be published (rewriting `workspace:^`).
 * 2. Assert `ttsc` is declared as a required peer dependency with a concrete caret
 *    range — no leaked `workspace:` protocol or exact pin a consumer cannot
 *    upgrade through.
 * 3. Assert `ttsc` is not also a bundled runtime `dependencies` entry.
 */
async function assertPackedManifestDeclaresTtscHost(): Promise<void> {
  const manifest = readPackedManifest();

  const peer = manifest.peerDependencies?.ttsc;
  assert.ok(
    typeof peer === "string" && peer.length !== 0,
    "published manifest must declare ttsc as a peer dependency host",
  );
  assert.doesNotMatch(
    peer,
    /^workspace:/,
    "workspace protocol leaked into the published ttsc spec",
  );
  assertCompatibleCaretRange(peer, "ttsc");
  assert.throws(
    () => assertCompatibleCaretRange(peer.slice(1), "ttsc"),
    /caret range/,
    "an exact ttsc pin must not satisfy the upgradeable-host contract",
  );
  assert.notEqual(
    manifest.peerDependenciesMeta?.ttsc?.optional,
    true,
    "the ttsc host must be required, not optional",
  );
  assert.equal(
    manifest.dependencies?.ttsc,
    undefined,
    "ttsc must stay external, not a bundled runtime dependency",
  );
}

/**
 * Assert that the packed export map and declaration files preserve the module
 * kind of every runtime branch, then compile representative consumers against
 * the extracted package rather than workspace source paths.
 */
function assertPackedEntrypointsProvideModuleFaithfulDeclarations(): void {
  const packed = packUnpluginPackage();
  assertModuleFaithfulExportMap(packed);

  const consumer = TestProject.tmpdir("ttsc-unplugin-types-");
  const packageTarget = path.join(
    consumer,
    "node_modules",
    "@ttsc",
    "unplugin",
  );
  TestProject.copyDirectory(packed.packageRoot, packageTarget);
  linkPackageDependency(
    consumer,
    "unplugin",
    path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "unplugin",
      "node_modules",
      "unplugin",
    ),
  );
  materializePublishedTtscTypes(consumer);
  TestProject.writeFiles(consumer, {
    "package.json": JSON.stringify({ private: true, type: "module" }),
    "tsconfig.nodenext.json": JSON.stringify({
      compilerOptions: {
        module: "nodenext",
        moduleResolution: "nodenext",
        noEmit: true,
        skipLibCheck: true,
        strict: true,
        verbatimModuleSyntax: true,
      },
      files: ["consumer.mts", "consumer.cts"],
    }),
    "tsconfig.bundler.json": JSON.stringify({
      compilerOptions: {
        module: "esnext",
        moduleResolution: "bundler",
        noEmit: true,
        skipLibCheck: true,
        strict: true,
        verbatimModuleSyntax: true,
      },
      files: ["consumer.ts"],
    }),
    "tsconfig.node10.json": JSON.stringify({
      compilerOptions: {
        ignoreDeprecations: "6.0",
        module: "esnext",
        moduleResolution: "node10",
        noEmit: true,
        skipLibCheck: true,
        strict: true,
      },
      files: ["consumer.node10.ts"],
    }),
    "consumer.mts": esmConsumerSource(),
    "consumer.cts": commonJsConsumerSource(),
    "consumer.ts": esmConsumerSource(),
    "consumer.node10.ts": `${esmConsumerSource()}
import type { TtscUnpluginOptions } from "@ttsc/unplugin/lib/core/options";
const options: TtscUnpluginOptions = {};
void options;
`,
  });

  for (const config of ["tsconfig.nodenext.json", "tsconfig.bundler.json"]) {
    const result = TestProject.spawn(
      TestProject.TSGO_BINARY,
      ["--project", config, "--pretty", "false"],
      { cwd: consumer },
    );
    assert.equal(
      result.status,
      0,
      `${config} failed against the packed declarations:\n${result.stdout}${result.stderr}`,
    );
  }
  const legacyCompiler = resolveLegacyTypeScriptCompiler();
  for (const config of ["tsconfig.nodenext.json", "tsconfig.node10.json"]) {
    const result = TestProject.spawn(
      process.execPath,
      [legacyCompiler, "--project", config, "--pretty", "false"],
      { cwd: consumer },
    );
    assert.equal(
      result.status,
      0,
      `ts-legacy ${config} failed against the packed declarations:\n${result.stdout}${result.stderr}`,
    );
  }
}

function assertModuleFaithfulExportMap({
  manifest,
  packageRoot,
}: PackedUnpluginPackage): void {
  assert.deepEqual(manifest.typesVersions, {
    "*": {
      "lib/*": ["lib/*"],
      "package.json": ["package.json"],
      "*": ["lib/*"],
    },
  });
  for (const [subpath, target] of Object.entries(manifest.exports ?? {}) as [
    string,
    any,
  ][]) {
    if (subpath === "./package.json") continue;
    assert.equal(
      typeof target,
      "object",
      `${subpath} must use conditional exports`,
    );
    const expectedStem = subpath === "." ? "index" : subpath.slice(2);
    const expected = {
      import: {
        types: `./lib/${expectedStem}.d.mts`,
        default: `./lib/${expectedStem}.mjs`,
      },
      require: {
        types: `./lib/${expectedStem}.d.cts`,
        default: `./lib/${expectedStem}.js`,
      },
      types: `./lib/${expectedStem}.d.ts`,
      default: `./lib/${expectedStem}.js`,
    };
    assert.deepEqual(target, expected, `${subpath} export conditions`);
    for (const file of [
      expected.import.types,
      expected.import.default,
      expected.require.types,
      expected.require.default,
      expected.types,
    ]) {
      assert.equal(
        fs.existsSync(path.join(packageRoot, file)),
        true,
        `${subpath} points at missing ${file}`,
      );
    }
  }
}

function linkPackageDependency(
  consumer: string,
  name: string,
  target: string,
): void {
  const link = path.join(consumer, "node_modules", ...name.split("/"));
  fs.mkdirSync(path.dirname(link), { recursive: true });
  fs.symlinkSync(
    fs.realpathSync(target),
    link,
    process.platform === "win32" ? "junction" : "dir",
  );
}

function materializePublishedTtscTypes(consumer: string): void {
  const source = path.join(TestProject.WORKSPACE_ROOT, "packages", "ttsc");
  const sourceManifest = JSON.parse(
    fs.readFileSync(path.join(source, "package.json"), "utf8"),
  );
  const target = path.join(consumer, "node_modules", "ttsc");
  TestProject.copyDirectory(path.join(source, "lib"), path.join(target, "lib"));
  TestProject.writeFiles(target, {
    "package.json": JSON.stringify({
      ...sourceManifest,
      ...sourceManifest.publishConfig,
      publishConfig: undefined,
    }),
  });
}

function resolveLegacyTypeScriptCompiler(): string {
  const unplugin = path.join(
    TestProject.WORKSPACE_ROOT,
    "packages",
    "unplugin",
  );
  const manifest = TestProject.REQUIRE_FROM_TEST.resolve(
    "ts-legacy/package.json",
    { paths: [unplugin] },
  );
  return path.join(path.dirname(manifest), "bin", "tsc");
}

function esmConsumerSource(): string {
  return `
import root from "@ttsc/unplugin";
import { resolveOptions } from "@ttsc/unplugin/api";
import bun from "@ttsc/unplugin/bun";
import register from "@ttsc/unplugin/bun-register";
import esbuild from "@ttsc/unplugin/esbuild";
import farm from "@ttsc/unplugin/farm";
import next from "@ttsc/unplugin/next";
import rolldown from "@ttsc/unplugin/rolldown";
import rollup from "@ttsc/unplugin/rollup";
import rspack from "@ttsc/unplugin/rspack";
import turbopack from "@ttsc/unplugin/turbopack";
import vite from "@ttsc/unplugin/vite";
import webpack from "@ttsc/unplugin/webpack";

type Factory = (...args: any[]) => unknown;
const factories = [
  root.vite,
  bun,
  register,
  esbuild,
  farm,
  next,
  rolldown,
  rollup,
  rspack,
  turbopack,
  vite,
  webpack,
] satisfies readonly Factory[];
vite();
resolveOptions();
void factories;
`;
}

function commonJsConsumerSource(): string {
  return `
import root = require("@ttsc/unplugin");
import api = require("@ttsc/unplugin/api");
import bun = require("@ttsc/unplugin/bun");
import register = require("@ttsc/unplugin/bun-register");
import esbuild = require("@ttsc/unplugin/esbuild");
import farm = require("@ttsc/unplugin/farm");
import next = require("@ttsc/unplugin/next");
import rolldown = require("@ttsc/unplugin/rolldown");
import rollup = require("@ttsc/unplugin/rollup");
import rspack = require("@ttsc/unplugin/rspack");
import turbopack = require("@ttsc/unplugin/turbopack");
import vite = require("@ttsc/unplugin/vite");
import webpack = require("@ttsc/unplugin/webpack");

type Factory = (...args: any[]) => unknown;
const factories = [
  root.default.vite,
  bun.default,
  register.default,
  esbuild.default,
  farm.default,
  next.default,
  rolldown.default,
  rollup.default,
  rspack.default,
  turbopack.default,
  vite.default,
  webpack.default,
] satisfies readonly Factory[];
vite.default();
api.resolveOptions();
void factories;
`;
}

function assertCompatibleCaretRange(range: string, dependency: string): void {
  const match =
    /^\^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.exec(
      range,
    );
  assert.ok(
    match,
    `${dependency} must publish a concrete caret range, received ${JSON.stringify(range)}`,
  );
  const major = Number(match[1]!);
  const minor = Number(match[2]!);
  const patch = Number(match[3]!);
  const lower: [number, number, number] = [major, minor, patch];
  const upper: [number, number, number] =
    major > 0
      ? [major + 1, 0, 0]
      : minor > 0
        ? [0, minor + 1, 0]
        : [0, 0, patch + 1];
  const accepts = (candidate: [number, number, number]): boolean =>
    compareVersions(candidate, lower) >= 0 &&
    compareVersions(candidate, upper) < 0;

  if (minor > 0 || major > 0) {
    assert.equal(
      accepts([major, minor, patch + 1]),
      true,
      `${dependency} must admit its next compatible patch`,
    );
  }
  assert.equal(
    accepts(upper),
    false,
    `${dependency} must reject its next incompatible boundary`,
  );
}

function compareVersions(
  left: [number, number, number],
  right: [number, number, number],
): number {
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
}

export {
  assertPackedEntrypointsProvideModuleFaithfulDeclarations,
  assertPackedManifestDeclaresTtscHost,
};
