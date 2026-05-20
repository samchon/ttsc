import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestStrip } from "../internal/TestStrip";

/**
 * Verifies the @ttsc/strip plugin: strip removes configured calls and debugger
 * statements.
 *
 * This is the core strip happy-path. It exercises explicit `calls` and
 * `statements` config via a tsconfig plugin entry, verifies that the wildcard
 * pattern `assert.*` removes the entire containing `if`-statement (not just the
 * inner call), and confirms declaration output is clean. Running the emitted
 * file through Node ensures stripping does not break the remaining runtime
 * behavior.
 *
 * 1. Create a project whose source mixes `console.log`, `console.debug`,
 *    `assert.equal`, `debugger`, an `if` guard containing `console.log`, and a
 *    kept `console.info` call.
 * 2. Configure the tsconfig plugin with explicit `calls` and `statements` lists,
 *    then run `ttsc --emit`.
 * 3. Assert the stripped identifiers are absent from `.js` and `.d.ts`,
 *    `console.info("kept")` survives, and `node dist/main.js` exits 0 with
 *    "kept" on stdout.
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
