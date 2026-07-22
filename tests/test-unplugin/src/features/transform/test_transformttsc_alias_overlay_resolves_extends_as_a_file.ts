import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { readEffectiveTsconfigPaths } from "../../../../packages/unplugin/lib/core/tsconfigPaths.js";

/**
 * The alias overlay must mirror TypeScript's file-only `extends` lookup so a
 * nearby directory cannot inject paths through its `tsconfig.json`.
 */
export const test_transformttsc_alias_overlay_resolves_extends_as_a_file =
  () => {
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
  };
