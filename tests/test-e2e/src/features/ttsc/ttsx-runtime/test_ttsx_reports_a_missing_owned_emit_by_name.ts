import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx fails naming both files when the output its checked build
 * emitted for a source has disappeared.
 *
 * Once a build is proven to own a source, its output is the only JavaScript
 * that may run for it. Falling through to the next lane would run something the
 * checked build never produced — an isolated emit without the project's
 * transforms, or, before samchon/ttsc#1382, another file's output. An owned
 * output that cannot be read is therefore an error that names the source and
 * the missing file.
 *
 * 1. Create a project whose entry locates its own build's output for `src/lazy.ts`
 *    through the runtime manifest and deletes it.
 * 2. Require `./lazy` afterwards.
 * 3. Assert the run fails naming `lazy.ts` and the missing `lazy.js`, and that
 *    `lazy.ts` never ran.
 * @evidence contracts/testing.md#behavioral-verification Deletes lazy.js from the live owned emit directory inside the running program, then requires lazy and expects a named missing-emit failure without lazy execution.
 * @evidence contracts/testing.md#independent-expectations The authored lazy.ts/lazy.js names and lazy-ran marker establish the error and forbidden effect independently of runtime ownership lookup.
 * @evidence contracts/testing.md#distinguishing-cases A deliberately missing owned output must fail rather than silently lower the original source; the lazy marker must not appear.
 * @evidence contracts/testing.md#execution-ownership This second runtime review entry is the named E2E export test_ttsx_reports_a_missing_owned_emit_by_name at this path, selected by tests/test-e2e/evidence.config.json; no direct-source unit equivalence is inferred without comparing its assertions.
 * @evidence contracts/e2e.md#necessary-boundary One real runtime mutates its published native output before Node require, exercising the owned-output failure connection.
 * @evidence contracts/e2e.md#shared-execution One host reuses its project emit and live manifest; the deletion is required state mutation and cannot be replaced by an immutable generic consumer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The mutation is confined to this host-owned emit directory; inspection occurs during execution and fixture ownership remains local.
 * @evidence contracts/e2e.md#preserved-coverage The named error, nonzero result and absent lazy marker remain here; no pure manifest decoder substitutes for this live deletion.
 */
export function test_ttsx_reports_a_missing_owned_emit_by_name() {
  const root = TestProject.createProject(FixtureFiles.read("ttsc/ttsx_reports_a_missing_owned_emit_by_name/inputs-1"));

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    { cwd: root },
  );
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(
    result.stderr,
    /the JavaScript emitted for .*lazy\.ts is missing: .*lazy\.js/,
  );
  assert.doesNotMatch(result.stdout, /lazy ran/);
}
