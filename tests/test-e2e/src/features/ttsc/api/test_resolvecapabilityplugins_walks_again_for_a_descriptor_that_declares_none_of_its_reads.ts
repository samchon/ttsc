import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolveCapabilityPlugins } from "ttsc";

import { createFakeGoBinary } from "../../../internal/ttsc/internal/source-build";

/**
 * Verifies the capability cache records no answer computed by a descriptor that
 * read a file without declaring it.
 *
 * `resolveCapabilityPlugins` answers from its record while every input the
 * plugin load proved holds its state. A file the descriptor reads with plain
 * `fs` is not among them, so an edit to it left the record answering what the
 * file used to say (samchon/ttsc#1561). No runtime ttsc supports can observe
 * such a read on every Node release, so only the answer of a load whose
 * descriptors declared their reads (`hostInputHashes`) is recorded.
 *
 * 1. Write a project whose descriptor declares the `probe` capability as
 *    `settings.json` says, read without a declaration.
 * 2. Resolve the capability.
 * 3. Turn the capability off in `settings.json`, resolve again, and assert the
 *    answer follows the file.
 *
 * @evidence contracts/testing.md#behavioral-verification Resolves probe:true from an undeclared settings.json read, writes probe:false and requires the next resolution to return zero capabilities.
 * @evidence contracts/testing.md#independent-expectations The separately authored settings values define each expected capability count; undeclared descriptor reads cannot justify reuse after their external state changes.
 * @evidence contracts/testing.md#distinguishing-cases True-to-false undeclared-read transition checks stale-answer rejection; declared stable reads and superseding module-resolution state have complementary entries.
 * @evidence contracts/testing.md#execution-ownership The matching TestExecutor feature evaluates an actual descriptor module and invokes a synthetic external Go provider, retaining E2E process ownership rather than claiming a direct unit.
 * @evidence contracts/e2e.md#necessary-boundary Reevaluation must cross the descriptor runtime/filesystem boundary after undeclared input mutation. This fixture proves resolver freshness, while real Go producer validity remains outside its synthetic provider.
 * @evidence contracts/e2e.md#shared-execution One project/settings file and provider serve both calls; only the changed undeclared input causes the repeated descriptor evaluation, with no per-case package install.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The settings file, module and caches are fresh registered fixture resources; saved environment provider/cache keys are restored in finally and suite exit removes the fixtures.
 * @evidence contracts/e2e.md#preserved-coverage Both original capability counts and the settings mutation remain. The case does not observe exact build counts or prove a real native artifact was produced.
 */
export const test_resolvecapabilityplugins_walks_again_for_a_descriptor_that_declares_none_of_its_reads =
  (): void => {
    const root = TestProject.tmpdir("ttsc-capability-undeclared-read-");
    const app = path.join(root, "app");
    const settings = path.join(app, "settings.json");
    write(path.join(root, "package.json"), '{ "private": true }\n');
    write(path.join(app, "package.json"), '{ "private": true }\n');
    write(settings, JSON.stringify({ probe: true }));
    writeGoModule(path.join(app, "go-plugin"));
    write(
      path.join(app, "plugin.cjs"),
      [
        'const fs = require("node:fs");',
        'const path = require("node:path");',
        "module.exports = (context) => ({",
        "  name: 'probe',",
        "  source: path.join(context.dirname, 'go-plugin'),",
        `  capabilities: JSON.parse(fs.readFileSync(${JSON.stringify(settings)}, "utf8")),`,
        "});",
        "",
      ].join("\n"),
    );
    write(
      path.join(app, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { plugins: [{ transform: "./plugin.cjs" }] },
      }),
    );
    const fakeGo = path.join(root, "fake-go");
    fs.mkdirSync(fakeGo, { recursive: true });
    const saved = {
      TTSC_CACHE_DIR: process.env.TTSC_CACHE_DIR,
      TTSC_GO_BINARY: process.env.TTSC_GO_BINARY,
      TTSC_GO_CACHE_DIR: process.env.TTSC_GO_CACHE_DIR,
    };
    process.env.TTSC_CACHE_DIR = path.join(root, "cache");
    process.env.TTSC_GO_BINARY = createFakeGoBinary(fakeGo);
    process.env.TTSC_GO_CACHE_DIR = path.join(root, "go-cache");
    try {
      const ask = () =>
        resolveCapabilityPlugins({ capability: "probe", cwd: app }).length;
      assert.equal(ask(), 1, "the first walk reads the capability");
      write(settings, JSON.stringify({ probe: false }));
      assert.equal(
        ask(),
        0,
        "the recorded answer outlived the undeclared read",
      );
    } finally {
      for (const [key, value] of Object.entries(saved))
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
  };

function writeGoModule(directory: string): void {
  write(
    path.join(directory, "go.mod"),
    "module example.com/plugin\n\ngo 1.26\n",
  );
  write(path.join(directory, "main.go"), "package main\n");
  for (const relative of [
    "vendor/local/value.go",
    "lib/helper.go",
    "dist/generated.go",
    "build/generated.go",
  ]) {
    write(path.join(directory, relative), "package generated\n");
  }
}

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}
