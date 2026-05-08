import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { commonJsProject, spawn, ttscBin } from "@ttsc/testing";
import { TestTtscUtilityPlugins } from "../../internal/ttsc-utility-plugins";

/**
 * Verifies utility plugins: legacy-named user options remain plugin config.
 *
 * This utility plugin scenario is isolated as one exported TypeScript feature
 * so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_ttsc_utility_plugins_legacy_named_user_options_remain_plugin_config =
  () => {
    const root = commonJsProject(
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
    TestTtscUtilityPlugins.seedUtilityPackages(root, ["banner"]);
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
    assert.equal(result.status, 0, result.stderr);
    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(js, /phase/);
  };
