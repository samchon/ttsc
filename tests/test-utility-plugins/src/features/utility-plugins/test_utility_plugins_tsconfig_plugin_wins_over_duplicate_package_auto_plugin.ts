import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { commonJsProject, spawn, ttscBin } from "@ttsc/testing";
import { TestUtilityPlugins } from "../../internal/utility-plugins";

/**
 * Verifies utility plugins: tsconfig plugin wins over duplicate package auto plugin.
 *
 * This utility plugin scenario is isolated as one exported TypeScript feature
 * so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_utility_plugins_tsconfig_plugin_wins_over_duplicate_package_auto_plugin =
  () => {
    const root = commonJsProject(
      {
        "src/main.ts": [
          `console.log("keep-log");`,
          `console.warn("drop-warn");`,
          `export const value = "explicit";`,
          ``,
        ].join("\n"),
      },
      {
        compilerOptions: {
          plugins: [{ transform: "@ttsc/strip", calls: ["console.warn"] }],
        },
      },
    );
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ devDependencies: { "@ttsc/strip": "0.8.1" } }),
    );
    TestUtilityPlugins.seedUtilityPackages(root, ["strip"]);

    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: TestUtilityPlugins.goPath(),
        TTSC_CACHE_DIR: fs.mkdtempSync(
          path.join(os.tmpdir(), "ttsc-auto-strip-explicit-"),
        ),
      },
    });
    assert.equal(result.status, 0, result.stderr);
    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(js, /console\.log\("keep-log"\)/);
    assert.doesNotMatch(js, /console\.warn/);
  };
