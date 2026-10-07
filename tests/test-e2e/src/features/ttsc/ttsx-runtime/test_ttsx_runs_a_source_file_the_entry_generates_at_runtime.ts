import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { FixtureFiles } from "../../../internal/FixtureFiles";

/**
 * Verifies ttsx runs a `.ts` source the entry writes into its own project at
 * runtime, after the up-front build already finished.
 *
 * A program can generate sources and import them in the same run — a test
 * corpus that writes thousands of feature files, then loads them. Those files
 * do not exist when `prepareExecution` type-checks and emits the entry project,
 * so the entry build never emits them. When one is later required, no build
 * owns its on-disk output, so the runtime hooks must still compile it on demand
 * (the orphan single-file path) and run it correctly. This pins that path: a
 * file created after the build must load and execute, not fail as missing.
 *
 * The generated file is CommonJS-classified (the project has no `type:
 * "module"`) and written with ECMAScript module syntax, so a plain type-strip
 * would leave its `export` dangling; the lowering must turn it into CommonJS.
 *
 * 1. The entry writes `src/generated/leaf.ts` (an `export const`) at runtime, then
 *    `require`s it.
 * 2. Run ttsx against the entry.
 * 3. Assert the generated module loaded and produced its value.
 *
 * @evidence contracts/testing.md#behavioral-verification An already running NodeNext CommonJS entry writes generated/leaf.ts and requires it extensionlessly, requiring VALUE42.
 * @evidence contracts/testing.md#independent-expectations The authored generated export and literal output determine the expected value independently of runtime discovery.
 * @evidence contracts/testing.md#distinguishing-cases A source absent during upfront compilation must become loadable after a real write; this entry supplies no generated type-error control.
 * @evidence contracts/testing.md#execution-ownership This second runtime review entry is the named E2E export test_ttsx_runs_a_source_file_the_entry_generates_at_runtime at this path, selected by tests/test-e2e/evidence.config.json; no direct-source unit equivalence is inferred without comparing its assertions.
 * @evidence contracts/e2e.md#necessary-boundary Actual runtime file generation, native fallback compilation and Node extensionless require form the necessary stateful connection.
 * @evidence contracts/e2e.md#shared-execution One host and source project share initial compiler preparation, then require new work only after the generated file exists.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The generated file belongs to the tracked project; its write precedes require and immutable pre-run membership cannot substitute for this state.
 * @evidence contracts/e2e.md#preserved-coverage The exact VALUE42 assertion remains here, without claiming a generated-source type-gate negative.
 */
export function test_ttsx_runs_a_source_file_the_entry_generates_at_runtime() {
  const root = TestProject.createProject(
    FixtureFiles.read(
      "ttsc/ttsx_runs_a_source_file_the_entry_generates_at_runtime/inputs-1",
    ),
  );

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    { cwd: root },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "VALUE:42");
}
