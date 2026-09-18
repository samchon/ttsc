import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { readEffectiveTsconfigPaths } from "../../../../../packages/unplugin/lib/core/tsconfig/readEffectiveTsconfigPaths.js";

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
