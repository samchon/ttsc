import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "../internal/TestBanner";

/**
 * Verifies the @ttsc/banner plugin: legacy-named user options remain plugin
 * config.
 *
 * Ts-patch/ttypescript allowed plugin options (`after`, `before`, `phase`)
 * alongside plugin-specific keys in the same tsconfig entry. The banner plugin
 * must treat all non-reserved keys as its own config — in particular `phase` is
 * both a legacy ts-patch lifecycle key and a valid banner config field. The
 * banner text must appear in the output regardless of what lifecycle keys are
 * also present in the descriptor.
 *
 * 1. Create a project whose tsconfig plugin entry mixes `text`, `after`, `before`,
 *    and `phase` in a single descriptor object.
 * 2. Run `ttsc --emit` against that project.
 * 3. Assert the output `.js` file contains the expected `phase` text from the
 *    `text` field.
 */
export const test_banner_keeps_legacy_named_user_options_as_plugin_config =
  () => {
    const root = TestProject.commonJsProject(
      {
        "src/main.ts": `export const value = "x";\n`,
      },
      {
        compilerOptions: {
          plugins: [
            {
              transform: "@ttsc/banner",
              text: "phase",
              after: true,
              before: true,
              phase: "custom-plugin-config",
            },
          ],
        },
      },
    );
    TestBanner.seedPackage(root);
    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "--emit"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(js, /phase/);
  };
