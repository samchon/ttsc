import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestStrip } from "../../internal/TestStrip";
import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";

/**
 * Verifies the @ttsc/strip plugin: strip removes configured calls and debugger
 * statements.
 *
 * This is the core strip happy-path. It exercises explicit `calls` and
 * `statements` config supplied via a `strip.config.json` file, verifies that
 * the wildcard pattern `assert.*` removes its call, the guarded `console.log`
 * body loses its call, and declaration output remains clean. Running
 * the emitted file through Node ensures stripping does not break the remaining
 * runtime behavior.
 *
 * 1. Create a project whose source mixes `console.log`, `console.debug`,
 *    `assert.equal`, `debugger`, an `if` guard containing `console.log`, and a
 *    kept `console.info` call; supply explicit `calls` and `statements` lists
 *    via `strip.config.json` (auto-discovered from the project root).
 * 2. Run `ttsc --emit` with the tsconfig plugin entry containing only the
 *    `transform` key (no inline config).
 * 3. Assert the stripped identifiers are absent from `.js` and `.d.ts`,
 *    `console.info("kept")` survives, and `node dist/main.js` exits 0 with
 *    "kept" on stdout.
 *
 * @evidence contracts/testing.md#behavioral-verification Configured emit removes log/debug/assert/debugger and drop-if while retaining console.info, StripBox/value declarations and Node stdout kept.
 * @evidence contracts/testing.md#independent-expectations Authored calls/statements rules independently establish removals and the remaining runtime output/declaration contract.
 * @evidence contracts/testing.md#distinguishing-cases Positive configured removals and negative console.info/declaration controls remain, including a guarded console.log body.
 * @evidence contracts/testing.md#execution-ownership This named test_strip_removes_configured_calls_and_debugger_statements entry runs through TestExecutor and the real built launcher or native host; portable decisions are separate Go units.
 * @evidence contracts/e2e.md#necessary-boundary Native statement mutation must serialize valid executable JS and preserve public declarations.
 * @evidence contracts/e2e.md#shared-execution One project emits JS and declarations and one Node process checks the surviving runtime; pure statement-shape distinctions run in linked-program units. Other unchanged native preparations reuse TestProject.sharedPluginCache, whose identity covers compiler, SDK, sources and overlays.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns fresh fixture directories until process exit, including failure; synchronous child processes finish before assertions. Sources/config remain fixed for their compilation, and only unchanged artifact inputs share the cache, never consumer results.
 * @evidence contracts/e2e.md#preserved-coverage Configured emit removes log/debug/assert/debugger and drop-if while retaining console.info, StripBox/value declarations and Node stdout kept. All original assertions remain in this named entry. TestLinkedProgramStripsDefaultStatementsAndPreservesDeclarations and TestLinkedProgramStripsCustomCallsOnlyInStatementPositions own AST list/body/callee/value-position distinctions; this case retains its original configuration or published-output boundary.
 */
export function test_strip_removes_configured_calls_and_debugger_statements() {
    const root = TestProject.commonJsProject(
      {
        "src/main.ts": `export interface StripBox { value: string }\nconst assert = { equal(left: number, right: number): void { if (left !== right) throw new Error("assertion failed"); } };\ndebugger;\nconsole.log("drop");\nconsole.debug("drop");\nassert.equal(1, 1);\nconsole.info("kept");\nexport const box: StripBox = { value: "kept" };\nif (box.value) console.log("drop-if");\n`,
        "strip.config.json": JSON.stringify({
          calls: ["console.log", "console.debug", "assert.*"],
          statements: ["debugger"],
        }),
      },
      {
        compilerOptions: {
          declaration: true,
          plugins: [{ transform: "@ttsc/strip" }],
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
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
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
}
