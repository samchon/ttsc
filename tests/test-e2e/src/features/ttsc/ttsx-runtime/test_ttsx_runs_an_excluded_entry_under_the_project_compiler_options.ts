import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { FixtureFiles } from "../../../internal/FixtureFiles";

/**
 * Verifies an entry outside the project's `include` takes its module format
 * from that project rather than from a default.
 *
 * "ttsx targets the tsconfig" is the whole contract for an excluded entry, and
 * the module option is the part of it with a consequence the run can show:
 * under the project's `nodenext` the package's missing `"type"` makes this a
 * CommonJS module and Node hands it `__dirname`. A synthesized entry project
 * that dropped the option would derive the kind from `target` instead, emit an
 * ES module, and print `esm` — so the two answers are distinguishable at run
 * time rather than merely asserted.
 *
 * Two options are deliberately not pinned here. `strict` cannot be, because
 * dropping it only makes a program compile that otherwise would not: its
 * inheritance is proved by the twin case, whose entry fails on an error
 * `strict` alone produces. `paths` cannot be either — it is a compile-time
 * mapping tsgo does not rewrite into the emit, so no ttsx entry resolves an
 * alias at run time, inside `include` or outside it.
 *
 * 1. Create a CommonJS-package project with `module: "nodenext"` and `include:
 *    ["src"]`.
 * 2. Run ttsx against a root-level script that reads `__dirname`.
 * 3. Assert it ran and reported `cjs`.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs excluded clear.ts under NodeNext project settings and requires aliased cjs from its CommonJS __dirname branch.
 * @evidence contracts/testing.md#independent-expectations The authored branch literal independently distinguishes usable CommonJS execution from the alternate branch.
 * @evidence contracts/testing.md#distinguishing-cases An excluded entry must retain module options; this value does not independently prove strict type-checking inheritance.
 * @evidence contracts/testing.md#execution-ownership This second runtime review entry is the named E2E export test_ttsx_runs_an_excluded_entry_under_the_project_compiler_options at this path, selected by tests/test-e2e/evidence.config.json; no direct-source unit equivalence is inferred without comparing its assertions.
 * @evidence contracts/e2e.md#necessary-boundary Actual excluded-entry native compilation and Node module execution connect project options to executable module semantics.
 * @evidence contracts/e2e.md#shared-execution One project and one host share installed compiler preparation without separate consumer installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Immutable config/source state belongs to the tracked fixture and lasts through synchronous completion until process-exit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage The exact aliased cjs output remains here without extending the assertion into an unobserved strict-diagnostic guarantee.
 */
export function test_ttsx_runs_an_excluded_entry_under_the_project_compiler_options() {
  const root = TestProject.createProject(
    FixtureFiles.read(
      "ttsc/ttsx_runs_an_excluded_entry_under_the_project_compiler_options/inputs-1",
    ),
  );

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "clear.ts"],
    { cwd: root },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "aliased cjs");
}
