import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx never runs a user's own `.js` file for a `.ts` beside it that
 * no build compiled, in a project with no `outDir`.
 *
 * With no `outDir`, the entry build's emit directory is a mirror of the project
 * root, and ttsx's virtual layout then links or copies the user's root-level
 * files into that mirror. A record of the build's outputs taken after the
 * layout counted a stale `tool.js` linked there as the build's output for
 * `tool.ts`, so the stale file ran for a source it was never compiled from
 * (samchon/ttsc#1382). The record is now taken before the layout exists.
 *
 * 1. Create a project with `include: ["src"]`, no `outDir`, a root-level
 *    `tool.ts`, and a stale `tool.js` beside it.
 * 2. Run `tool.ts` directly, then run an entry that requires it.
 * 3. Assert both runs execute `tool.ts` itself.
 * @evidence contracts/testing.md#behavioral-verification Ttsx directly runs excluded tool.ts and then requires it from src/main.ts; both must print fresh tool.ts rather than the authored STALE tool.js sibling.
 * @evidence contracts/testing.md#independent-expectations Different literal TS/JS output strings independently distinguish source-owned emission from incidental basename matching.
 * @evidence contracts/testing.md#distinguishing-cases No outDir lets virtual source layout expose a stale sibling. Direct entry and runtime-required root both exercise that collision; no content mutation is involved.
 * @evidence contracts/testing.md#execution-ownership The named test_ttsx_never_runs_a_stale_javascript_file_beside_an_uncompiled_source E2E entry owns the actual bootstrap and observations specified here. TestProject/internal helpers supply fixtures and completed process results; this acknowledgment does not infer portable unit coverage from similarly named tests.
 * @evidence contracts/e2e.md#necessary-boundary Native emit ownership capture must precede virtual-layout linking so Node serves compiled TS, not copied JS. Direct index lookup cannot prove the live layout does not contaminate provenance.
 * @evidence contracts/e2e.md#shared-execution One immutable project/collision fixture serves two host lifetimes for distinct entry/require connections. No per-case package install occurs, but two compiler/runtime preparations still remain.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Stale JS remains deliberately present in the fixture for both runs; synchronous exit separates host state. TestProject owns root and best-effort final cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Original two statuses and exact fresh outputs remain. Output-list provenance and same-name negative survive; absence of extra file writes is not asserted here.
 */
export function test_ttsx_never_runs_a_stale_javascript_file_beside_an_uncompiled_source() {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "stale-beside", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          types: [],
        },
        include: ["src"],
      }),
      "tool.ts": `export const tool: string = "fresh tool.ts";\nconsole.log(tool);\n`,
      "tool.js": `console.log("STALE tool.js");\nexports.tool = "STALE tool.js";\n`,
      "src/main.ts": [
        `declare const require: (id: string) => { tool: string };`,
        `require("../tool.ts");`,
        `export {};`,
        ``,
      ].join("\n"),
    });

    for (const entry of ["tool.ts", "src/main.ts"]) {
      const result = TestProject.spawn(
        TestProject.TTSX_BIN,
        ["--cwd", root, entry],
        { cwd: root },
      );
      assert.equal(result.status, 0, `${entry}: ${result.stderr}`);
      assert.equal(result.stdout.trim(), "fresh tool.ts", entry);
    }
  }
