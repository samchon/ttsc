import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestStrip } from "../internal/TestStrip";

/**
 * Verifies the @ttsc/strip plugin: strip removes configured calls and debugger
 * statements.
 *
 * This strip feature is isolated as one exported TypeScript test so failures
 * identify the exact package contract without a shared smoke wrapper.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc path that loads @ttsc/strip from package or tsconfig
 *    plugin options.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_strip_removes_configured_calls_and_debugger_statements =
  () => {
    const root = TestProject.commonJsProject(
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
    TestStrip.seedPackage(root);
    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "--emit"],
      {
        cwd: root,
        env: {
          PATH: TestStrip.goPath(),
          TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-strip-"),
        },
      },
    );
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
    const run = TestProject.runNode(path.join(root, "dist", "main.js"), {
      cwd: root,
    });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout.trim(), "kept");
  };
