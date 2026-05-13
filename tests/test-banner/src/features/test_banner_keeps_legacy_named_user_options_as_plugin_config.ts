import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "../internal/TestBanner";

/**
 * Verifies the @ttsc/banner plugin: legacy-named user options remain plugin
 * config.
 *
 * This banner feature is isolated as one exported TypeScript test so failures
 * identify the exact package contract without a shared smoke wrapper.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc path that loads @ttsc/banner as a project plugin.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
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
