import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { commonJsProject, runNode, spawn, ttscBin } from "@ttsc/testing";
import { TestTtscUtilityPlugins } from "../internal/ttsc-utility-plugins";

/**
 * Verifies utility plugins: strip removes configured calls and debugger statements.
 *
 * This utility plugin scenario is isolated as one exported TypeScript feature
 * so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_ttsc_utility_plugins_strip_removes_configured_calls_and_debugger_statements =
  () => {
    const root = commonJsProject(
      {
        "src/main.ts": `export interface StripBox { value: string }\nconst assert = { equal(left: number, right: number): void { if (left !== right) throw new Error("assertion failed"); } };\ndebugger;\nconsole.log("drop");\nconsole.debug("drop");\nassert.equal(1, 1);\nconsole.info("kept");\nexport const box: StripBox = { value: "kept" };\nif (box.value) console.log("drop-if");\n`,
      },
      {
        compilerOptions: {
          declaration: true,
          plugins: [
            {
              transform: "@ttsc/strip",
              calls: ["console.log", "console.debug", "assert.*"],
              statements: ["debugger"],
            },
          ],
        },
      },
    );
    TestTtscUtilityPlugins.seedUtilityPackages(root, ["strip"]);
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: TestTtscUtilityPlugins.goPath(),
        TTSC_CACHE_DIR: fs.mkdtempSync(
          path.join(os.tmpdir(), "ttsc-utility-strip-"),
        ),
      },
    });
    assert.equal(result.status, 0, result.stderr);
    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.doesNotMatch(js, /console\.(?:log|debug)/);
    assert.doesNotMatch(js, /\bdebugger\b/);
    assert.doesNotMatch(js, /assert\.equal/);
    assert.doesNotMatch(js, /drop-if/);
    assert.match(js, /console\.info\("kept"\)/);
    const dts = fs.readFileSync(path.join(root, "dist", "main.d.ts"), "utf8");
    assert.match(dts, /interface StripBox/);
    assert.match(dts, /value: string/);
    assert.doesNotMatch(dts, /console|debugger|assert/);
    const run = runNode(path.join(root, "dist", "main.js"), { cwd: root });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout.trim(), "kept");
  };
