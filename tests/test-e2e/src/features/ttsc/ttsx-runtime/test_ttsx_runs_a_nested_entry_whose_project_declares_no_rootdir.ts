import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx runs a check-only project whose sources sit under `src` and
 * whose tsconfig declares no `rootDir`.
 *
 * The runner emits into a PID-isolated temp directory, and that injected
 * `outDir` is what makes tsgo demand an explicit layout (TS5011) from a project
 * that declares no output at all — the same project `tsgo -p .`, `ttsc`, and
 * `ttsc --emit` all accept. ttsx answers the demand by pinning the root tsgo
 * itself infers, so a nested import must still resolve through the mirrored
 * emit and no JavaScript may appear beside the sources: a root that missed by
 * one directory would put the inputs outside it, and tsgo writes an input
 * outside `rootDir` to its own source path (issue #1172).
 *
 * 1. Build a `noEmit` project with sources under `src/` and no `rootDir`.
 * 2. Run ttsx against `src/main.ts`, which imports `src/lib/greeting.ts`.
 * 3. Assert the program printed the imported value and left no `.js` on disk.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx executes a nested noEmit project without rootDir or outDir; exact no-rootdir-nested output, zero status and no JavaScript beside either source distinguish the TS5011/layout regression.
 * @evidence contracts/testing.md#independent-expectations Authored greeting text and fixed src/main.js/src/lib/greeting.js paths define expectations independently of synthesized compiler root or output mapping.
 * @evidence contracts/testing.md#distinguishing-cases Nested source depth changes inferred source layout relative to the flat complementary case; both noEmit and absent output/root settings remain active input distinctions.
 * @evidence contracts/testing.md#execution-ownership This matching named E2E entry owns one actual launcher/native compiler/Node session and checks two independent source-adjacent paths.
 * @evidence contracts/e2e.md#necessary-boundary A runtime-only output/root adapter must prevent native TS5011 while retaining the nested import layout and containing real emit; no classifier-only call establishes those compiler and loader effects.
 * @evidence contracts/e2e.md#shared-execution One nested root preparation and host serve both module and containment observations; its differing source-depth compiler profile currently remains separate from the flat case.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Fresh immutable sources have no stale JavaScript that could satisfy execution; synchronous child completion and TestProject cleanup own the process and fixture lifetimes.
 * @evidence contracts/e2e.md#preserved-coverage Original exact greeting, status and both source-adjacent JavaScript absence checks remain; consolidation of the differing compiler layout has not been asserted without a verified owner.
 */
export function test_ttsx_runs_a_nested_entry_whose_project_declares_no_rootdir() {
    const root = TestProject.commonJsProject(
      FixtureFiles.read("ttsc/ttsx_runs_a_nested_entry_whose_project_declares_no_rootdir/inputs-1"),
      {
        compilerOptions: {
          // The shape the issue reports: output is never configured, so the
          // project has no layout to declare.
          noEmit: true,
          outDir: undefined,
          rootDir: undefined,
        },
      },
    );

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    assert.equal(result.stdout.trim(), "no-rootdir-nested");
    for (const leaked of [
      path.join(root, "src", "main.js"),
      path.join(root, "src", "lib", "greeting.js"),
    ]) {
      assert.equal(
        fs.existsSync(leaked),
        false,
        `the runtime emit escaped into the source tree at ${leaked}`,
      );
    }
  }
