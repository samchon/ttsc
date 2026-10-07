import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { readEffectiveTsconfigPaths } from "../../../../../packages/unplugin/src/core/tsconfig/readEffectiveTsconfigPaths";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies the alias overlay resolves an `extends` specifier as a config file,
 * never as a directory.
 *
 * The adapter re-reads the effective `paths` of the `extends` chain before it
 * writes the alias overlay. It must follow TypeScript's file-then-`.json` rule.
 * A same-named directory is never a config, and a spelling that already ends in
 * `.json` is not extended again.
 *
 * 1. Create a project whose `extends: "../config"` names both a `config/`
 *    directory and a `config.json` file.
 * 2. Assert the effective paths come from `config.json`.
 * 3. Remove `config.json` and assert the directory contributes nothing.
 * 4. Assert an explicit `.json` spelling is not given a second suffix.
 *
 * @evidence contracts/testing.md#behavioral-verification The authored effective-paths reader resolves extensionless extends to config.json, refuses the same-named directory and never adds .json twice to an explicit suffix.
 * @evidence contracts/testing.md#independent-expectations Literal file/* versus directory/* declarations and empty negative expectations distinguish the supported file resolution rule independently of runtime output.
 * @evidence contracts/testing.md#distinguishing-cases Three assertions: an extensionless extends with both a config.json file and a same-named config directory (the file wins), the same extends after config.json is removed (the directory contributes nothing), and an explicit .json extends where only a double-suffixed explicit.json.json exists (nothing is read).
 * @evidence contracts/testing.md#execution-ownership Unit test: calls the real readEffectiveTsconfigPaths directly on tsconfig files it writes into a temporary directory and rewrites between calls. No compiler, plugin or host runs.
 */
export async function test_transformttsc_alias_overlay_resolves_extends_as_a_file(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-unplugin-extends-");
  const configDirectory = path.join(root, "config");
  const project = path.join(root, "project");
  fs.mkdirSync(configDirectory, { recursive: true });
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(
    path.join(configDirectory, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { paths: { "directory/*": ["./directory/*"] } },
    }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "config.json"),
    JSON.stringify({
      compilerOptions: { paths: { "file/*": ["./file/*"] } },
    }),
    "utf8",
  );
  const tsconfig = path.join(project, "tsconfig.json");
  fs.writeFileSync(
    tsconfig,
    JSON.stringify({ extends: "../config", compilerOptions: {} }),
    "utf8",
  );

  assert.deepEqual(readEffectiveTsconfigPaths(tsconfig), {
    "file/*": [path.join(root, "file", "*").replace(/\\/g, "/")],
  });

  fs.unlinkSync(path.join(root, "config.json"));
  assert.deepEqual(readEffectiveTsconfigPaths(tsconfig), {});

  fs.writeFileSync(
    path.join(root, "explicit.json.json"),
    JSON.stringify({
      compilerOptions: { paths: { "double/*": ["./double/*"] } },
    }),
    "utf8",
  );
  fs.writeFileSync(
    tsconfig,
    JSON.stringify({ extends: "../explicit.json", compilerOptions: {} }),
    "utf8",
  );
  assert.deepEqual(
    readEffectiveTsconfigPaths(tsconfig),
    {},
    "an explicit .json target must not probe a double suffix",
  );
}
