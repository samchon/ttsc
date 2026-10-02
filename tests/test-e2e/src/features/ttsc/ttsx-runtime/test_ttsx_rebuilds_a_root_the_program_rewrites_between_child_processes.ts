import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx rebuilds a root outside every build when the program rewrites
 * it between two child processes of one run.
 *
 * A root no build compiled is built once and shared across the processes of a
 * run, like a dependency. That sharing is only sound while the root is the same
 * file it was: a program that generates `job.ts`, runs it in a child process,
 * regenerates it, and runs it again must execute the second version. The root's
 * content is therefore part of what identifies its build.
 *
 * 1. Create a project whose entry writes `generated/job.ts`, runs it with `node`,
 *    rewrites it, and runs it again. Each child inherits the runtime hooks and
 *    manifest.
 * 2. Run the entry.
 * 3. Assert the children print the first and then the second version.
 * @evidence contracts/testing.md#behavioral-verification One ttsx parent writes generated/job.ts as first, starts a Node child, rewrites it to second and starts another; parent must print first,second.
 * @evidence contracts/testing.md#independent-expectations The two authored source versions determine expected child stdout independently of shared-run cache state.
 * @evidence contracts/testing.md#distinguishing-cases The generated root is outside the prebuilt include, and both children inherit runtime hooks/manifest in one run. Changed content at one path must differ from safe shared immutable reuse.
 * @evidence contracts/testing.md#execution-ownership The named test_ttsx_rebuilds_a_root_the_program_rewrites_between_child_processes E2E entry owns the actual bootstrap and observations specified here. TestProject/internal helpers supply fixtures and completed process results; this acknowledgment does not infer portable unit coverage from similarly named tests.
 * @evidence contracts/e2e.md#necessary-boundary Actual inherited manifest ownership and cross-process root compilation must execute the newly written bytes. Direct content-key tests cannot prove both live children receive the right generation.
 * @evidence contracts/e2e.md#shared-execution One parent project/host and two child lifetimes share the run. Source mutation genuinely requires another root preparation; a shared old generation is not equivalent work.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each complete rewrite precedes synchronous spawn, and child status failure throws into the parent. Runtime owns shared run state while TestProject owns generated fixture directories.
 * @evidence contracts/e2e.md#preserved-coverage Original parent status and exact first,second retain both child results. Cache file counts and cleanup are not explicitly asserted by this entry.
 */
export function test_ttsx_rebuilds_a_root_the_program_rewrites_between_child_processes() {
    const root = TestProject.createProject(E2eProcessTrace.fixtureFiles(FixtureFiles.read("ttsc/ttsx_rebuilds_a_root_the_program_rewrites_between_child_processes/inputs-1")));

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "first,second");
  }
