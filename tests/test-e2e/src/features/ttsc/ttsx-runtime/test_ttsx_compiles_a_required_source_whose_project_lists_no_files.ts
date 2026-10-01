import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx compiles a required source through its owning project's options
 * when that project's own build produces nothing.
 *
 * A config that lists no files emits nothing, so the runtime's build of the
 * owning project has no output to serve. That says nothing about the file the
 * program reached, which is a root the build did not compile like any other,
 * and it must still get the project's options and type gate. Falling back to
 * the isolated emit instead would drop both. The legacy decorator's argument
 * count identifies the project's options: `experimentalDecorators` passes three
 * arguments to a method decorator, where standard decorators pass two.
 *
 * 1. Create `tools/tsconfig.json` with `experimentalDecorators` and `files: []`,
 *    and a `tools/probe.ts` beside it that records a method decorator's
 *    argument count.
 * 2. Run an entry that requires `tools/probe.ts` by path.
 * 3. Assert the program observes the legacy decorator's three arguments.
 * @evidence contracts/testing.md#behavioral-verification Ttsx requires tools/probe.ts whose owning config has files:[] and experimentalDecorators; status zero and arguments=3 must result.
 * @evidence contracts/testing.md#independent-expectations Legacy method decorator invocation has three arguments instead of the standard decorator pair, independently witnessing the selected compiler option.
 * @evidence contracts/testing.md#distinguishing-cases The empty owning project cannot provide the requested output, but its options must apply to the separately checked root. This entry has no mistyped counterexample or build-count assertion.
 * @evidence contracts/testing.md#execution-ownership The discoverable named test_ttsx_compiles_a_required_source_whose_project_lists_no_files entry belongs to the TypeScript E2E population and executes the actual launch/bootstrap path described here. Its fixture helpers do not register hidden assertion hosts; no portable unit owner is inferred without exact body comparison.
 * @evidence contracts/e2e.md#necessary-boundary Native compiler option inheritance must survive empty-program fallback into an actually executed decorator. Direct config discovery cannot prove the emitted runtime semantics.
 * @evidence contracts/e2e.md#shared-execution One consumer and one excluded probe use one host; the empty owning-project attempt and fallback root emit have different compilation inputs. The separate two-root logging case owns deduplication.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer and tools files are immutable during the run. Synchronous spawn ends the host; TestProject tracks all fixture directories until test-process exit.
 * @evidence contracts/e2e.md#preserved-coverage Original zero exit and exact arguments=3 remain. Neither failed-build memoization nor negative type-gate behavior is claimed from this single positive witness.
 */
export function test_ttsx_compiles_a_required_source_whose_project_lists_no_files() {
    const root = TestProject.createProject(FixtureFiles.read("ttsc/ttsx_compiles_a_required_source_whose_project_lists_no_files/inputs-1"));

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "arguments=3");
  }
