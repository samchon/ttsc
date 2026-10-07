import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { E2eProcessTrace } from "../../../../../../utils/src/E2eProcessTrace";
import { FixtureFiles } from "../../../../internal/FixtureFiles";

/**
 * Verifies ttsx propagates its source loader to child processes the program
 * spawns itself.
 *
 * Libraries like `tgrid` run work in a separate process started with `node
 * worker.ts`. That child is not launched through ttsx, so it must inherit the
 * hooks another way: ttsx puts the installer on `NODE_OPTIONS` (and the runtime
 * manifest / tsgo binary on the environment), which every descendant inherits —
 * the same mechanism `ts-node` uses with `--require`. The child then runs its
 * own `.ts` entry from source and resolves a raw `.ts` dependency.
 *
 * 1. Create a project whose entry spawns `node worker.ts` with inherited stdio.
 * 2. `worker.ts` imports a published raw `.ts` dependency and prints its value.
 * 3. Assert the child ran and the dependency loaded, surfaced through the parent.
 *
 * @evidence contracts/testing.md#behavioral-verification The launcher starts a native Node worker with inherited environment; zero status and worker:child-loaded-dependency prove that descendant hooks serve an actual raw TypeScript package.
 * @evidence contracts/testing.md#independent-expectations The fixture worker imports the independently authored literal dependency value, rather than reading runtime metadata as its expected answer.
 * @evidence contracts/testing.md#distinguishing-cases This owns direct spawnSync inheritance into a typed worker; forked .js main rescue and detached descendant retention are separate entries.
 * @evidence contracts/testing.md#execution-ownership This named filename-matching E2E entry runs the real built launcher or public register and native host. Portable option/cache decisions stay in source units; recursive main24 and the explicit Node compatibility directory both select this actual boundary.
 * @evidence contracts/e2e.md#necessary-boundary The launcher starts a native Node worker with inherited environment; zero status and worker:child-loaded-dependency prove that descendant hooks serve an actual raw TypeScript package. Direct source calls cannot prove this NativeNode loader or process connection.
 * @evidence contracts/e2e.md#shared-execution One compiler workspace and parent host supply the inherited hooks and manifest to one worker; a second process is necessary to exercise environment inheritance.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The isolated project owns worker and package inputs; synchronous inherited-stdio spawn completes the worker before its parent returns.
 * @evidence contracts/e2e.md#preserved-coverage All original meaningful status, output and state assertions remain in this named entry; physical directory selection removes only repeated unrelated portable cases from floor/current execution, while main24 retains the entire runtime population.
 */
export function test_ttsx_propagates_the_source_loader_to_a_child_process() {
  const root = TestProject.createProject(
    E2eProcessTrace.fixtureFiles(
      FixtureFiles.read(
        "ttsc/ttsx_propagates_the_source_loader_to_a_child_process/inputs-1",
      ),
    ),
  );

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    { cwd: root },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "worker:child-loaded-dependency");
}
