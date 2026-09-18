import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { PackedUnpluginPackage } from "../../internal/packaged-host-contract/PackedUnpluginPackage";
import { packUnpluginPackage } from "../../internal/packaged-host-contract/packUnpluginPackage";

/**
 * Assert that the packed export map and declaration files preserve the module
 * kind of every runtime branch, then compile representative consumers against
 * the extracted package rather than workspace source paths.
 */
export async function test_packaged_entrypoints_publish_module_faithful_declarations(): Promise<void> {
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
  assert.deepEqual(
    manifest.sideEffects,
    [
      "./lib/bun-register.js",
      "./lib/bun-register.mjs",
      "./lib/core/bun/register.js",
      "./lib/core/bun/register.mjs",
    ],
    "the published runtime registration entries must survive bare-import tree shaking",
  );
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
