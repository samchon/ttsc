import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { commonJsProject, spawn, ttscBin } from "@ttsc/testing";
import { TestTtscUtilityPlugins } from "../../internal/ttsc-utility-plugins";

/**
 * Verifies utility plugins: package ttsc.plugin auto-discovers strip defaults.
 *
 * This utility plugin scenario is isolated as one exported TypeScript feature
 * so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_ttsc_utility_plugins_package_ttsc_plugin_auto_discovers_strip_defaults =
  () => {
    const root = commonJsProject({
      "src/main.ts": [
        `declare const assert: { equal(left: unknown, right: unknown): void };`,
        `console.log("drop-log");`,
        `console.debug("drop-debug");`,
        `assert.equal("drop", "assert");`,
        `debugger;`,
        `export const value = "kept";`,
        ``,
      ].join("\n"),
    });
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ dependencies: { "@ttsc/strip": "0.8.1" } }),
    );
    TestTtscUtilityPlugins.seedUtilityPackages(root, ["strip"]);

    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: TestTtscUtilityPlugins.goPath(),
        TTSC_CACHE_DIR: fs.mkdtempSync(
          path.join(os.tmpdir(), "ttsc-auto-strip-"),
        ),
      },
    });
    assert.equal(result.status, 0, result.stderr);
    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(js, /kept/);
    assert.doesNotMatch(
      js,
      /console\.(?:log|debug)|assert\.equal|\bdebugger\b/,
    );
  };
