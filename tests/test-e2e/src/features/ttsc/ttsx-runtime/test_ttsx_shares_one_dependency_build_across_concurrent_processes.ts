import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx builds a dependency once and shares it across concurrent child
 * processes instead of each rebuilding into the same directory.
 *
 * A program can fan out into many processes at once (a benchmark, a worker
 * pool). Each inherits the runtime manifest, so without a shared cache every
 * process would rebuild every dependency — and several would write the same
 * output directory simultaneously and corrupt each other, wedging the run. ttsx
 * keys each dependency build under the shared per-run cache, guarded by a lock,
 * so the first process builds and the rest reuse.
 *
 * 1. Create a project whose entry spawns several `node worker.ts` children at
 *    once; each imports the same raw `.ts` dependency that owns a tsconfig (so
 *    it is built, not type-stripped).
 * 2. Run ttsx against the entry.
 * 3. Assert every concurrent child loaded the dependency and exited cleanly.
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx fans out three simultaneous workers importing one configured dependency. All must print its literal value and the parent must succeed, detecting corrupted publication or loader propagation.
 * @evidence contracts/testing.md#independent-expectations The authored dependency exports shared-built-once and exactly three workers are started; sorted literal output requires three observations independently of cache internals.
 * @evidence contracts/testing.md#distinguishing-cases Three concurrent readers share a dependency and inherited runtime manifest. Dead-owner and cache-invalidation decisions have other owners; this assertion does not count builds.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry owns one launcher and three actual child processes.
 * @evidence contracts/e2e.md#necessary-boundary Inherited loader state and concurrent publication require separate actual processes; direct lock units cannot prove every child executes the served module.
 * @evidence contracts/e2e.md#shared-execution One root/dependency identity serves three concurrent workers. Their lifetimes are contention participants, with no explicit per-worker artifact preparation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Workers consume unchanged identity/cache inputs. Promise.all waits for all exits before parent completion and TestProject cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Three worker outputs and parent zero status remain. The historical headline exceeds the assertions: successful concurrent consumers do not independently measure exactly one compiler invocation.
 */
export function test_ttsx_shares_one_dependency_build_across_concurrent_processes() {
    const root = TestProject.createProject(FixtureFiles.read("ttsc/ttsx_shares_one_dependency_build_across_concurrent_processes/inputs-1"));

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      result.stdout.trim().split("\n").sort().join(","),
      "worker:shared-built-once,worker:shared-built-once,worker:shared-built-once",
    );
  }
