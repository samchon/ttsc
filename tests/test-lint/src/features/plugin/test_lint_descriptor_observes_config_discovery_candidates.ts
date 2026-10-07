import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { TestLintPlugin } from "../internal/TestLintPlugin";

/**
 * Verifies the lint descriptor observes every config candidate through the
 * first directory that holds one, and refuses an ambiguous directory.
 *
 * Native discovery probes fourteen `lint.config.*` and `ttsc-lint.config.*`
 * names per directory, treats a directory wearing such a name as absent, and
 * fails when one directory holds two files. The descriptor must report the
 * complete probed set, absent names included, so a host can invalidate a
 * generation when a nearer config appears. The host's `pluginConfigDir` anchor
 * replaces the tsconfig directory, and an explicit `configFile` observes only
 * itself.
 *
 * 1. Build a project whose nested directory holds a directory named
 *    `lint.config.ts` and whose parent holds a plain-JSON
 *    `ttsc-lint.config.json`.
 * 2. Discover from the nested tsconfig and assert the twenty-eight probed paths in
 *    native order with the file digest, the directory marker digest, the
 *    junction target and nulls.
 * 3. Add a second config beside the first and require the ambiguity error, then
 *    re-anchor through `pluginConfigDir` and an explicit relative
 *    `configFile`.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the authored createTtscPlugin factory on a plain JSON config so no evaluator runs, and asserts the returned hostInputs, hostInputHashes and hostInputRealpaths for a two-directory walk, the multiple-config error, the pluginConfigDir anchor and the explicit configFile observation.
 * @evidence contracts/testing.md#independent-expectations Digests are computed with node:crypto over literal bytes and the documented directory marker, the candidate order is the authored fourteen-name list, and the directory candidate's physical target is the junction target the test created; none of it is read back from the factory.
 * @evidence contracts/testing.md#distinguishing-cases The parent walk stops at the first directory with exactly one non-directory match so the grandparent is never probed, the directory impostor reports a marker digest rather than a match, two files in one directory contrast with one, and an anchor override or explicit file changes which paths are observed.
 * @evidence contracts/testing.md#execution-ownership The matching src/features function runs the authored factory in the source-unit Node process over a temporary tree removed in finally; plain JSON needs no evaluator, and no native code is built or product host started.
 */
export function test_lint_descriptor_observes_config_discovery_candidates(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-lint-discovery-")),
  );
  try {
    const factory = TestLintPlugin.loadFactory();
    const project = path.join(root, "project");
    const nested = path.join(project, "nested");
    const decoyTarget = path.join(root, "decoy-target");
    fs.mkdirSync(nested, { recursive: true });
    fs.mkdirSync(decoyTarget);
    fs.writeFileSync(path.join(root, "lint.config.mjs"), "grandparent");
    const parentConfig = path.join(project, "ttsc-lint.config.json");
    fs.writeFileSync(parentConfig, '{"rules":{}}');
    const impostor = path.join(nested, "lint.config.ts");
    fs.symlinkSync(decoyTarget, impostor, "junction");

    const names = [
      "lint.config.json",
      "lint.config.js",
      "lint.config.mjs",
      "lint.config.cjs",
      "lint.config.ts",
      "lint.config.mts",
      "lint.config.cts",
      "ttsc-lint.config.json",
      "ttsc-lint.config.js",
      "ttsc-lint.config.mjs",
      "ttsc-lint.config.cjs",
      "ttsc-lint.config.ts",
      "ttsc-lint.config.mts",
      "ttsc-lint.config.cts",
    ];
    const sha256 = (value: string): string =>
      createHash("sha256").update(value).digest("hex");
    const context = {
      ...TestLintPlugin.factoryContext({ transform: "@ttsc/lint" }),
      cwd: nested,
      projectRoot: nested,
      tsconfig: path.join(nested, "tsconfig.json"),
    };

    const discovered = factory(context);
    const expectedInputs = [nested, project].flatMap((directory) =>
      names.map((name) => path.join(directory, name)),
    );
    assert.deepEqual(discovered.hostInputs, expectedInputs);
    const hashes: Record<string, string | null> = {};
    const realpaths: Record<string, string | null> = {};
    for (const input of expectedInputs) {
      hashes[input] = null;
      realpaths[input] = null;
    }
    hashes[impostor] = sha256("ttsc:host-input:directory\0");
    realpaths[impostor] = decoyTarget;
    hashes[parentConfig] = sha256('{"rules":{}}');
    realpaths[parentConfig] = parentConfig;
    assert.deepEqual(discovered.hostInputHashes, hashes);
    assert.deepEqual(discovered.hostInputRealpaths, realpaths);
    assert.equal(discovered.contributors, undefined);

    const sibling = path.join(project, "lint.config.json");
    fs.writeFileSync(sibling, "{}");
    assert.throws(
      () => factory(context),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes(`found in ${project} `));
        assert.match(
          error.message,
          /\(lint\.config\.json, ttsc-lint\.config\.json\)/,
        );
        assert.match(error.message, /configFile/);
        return true;
      },
    );
    fs.rmSync(sibling);

    const anchored = factory({ ...context, pluginConfigDir: project });
    assert.deepEqual(
      anchored.hostInputs,
      names.map((name) => path.join(project, name)),
    );

    const explicit = factory({
      ...context,
      pluginConfigDir: project,
      plugin: {
        transform: "@ttsc/lint",
        configFile: "./ttsc-lint.config.json",
      },
    });
    assert.deepEqual(explicit.hostInputs, [parentConfig]);
    assert.deepEqual(explicit.hostInputHashes, {
      [parentConfig]: sha256('{"rules":{}}'),
    });
    assert.deepEqual(explicit.hostInputRealpaths, {
      [parentConfig]: parentConfig,
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
