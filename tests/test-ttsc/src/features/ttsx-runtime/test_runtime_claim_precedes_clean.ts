import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveSafeCacheCleanupTargets } from "../../../../../packages/ttsc/src/internal/resolveSafeCacheCleanupTargets";
import { ProcessOwnedDirectory } from "../../../../../packages/ttsc/src/launcher/internal/runtime/ProcessOwnedDirectory";
import { claimRuntimeProjectDirectory } from "../../../../../packages/ttsc/src/launcher/internal/runtime/claimRuntimeProjectDirectory";
import { resolveRuntimeCleanTargets } from "../../../../../packages/ttsc/src/launcher/internal/runtime/resolveRuntimeCleanTargets";
import { runtimeRunKey } from "../../../../../packages/ttsc/src/launcher/internal/runtime/runtimeRunKey";
import { withRuntimeDirectoryLock } from "../../../../../packages/ttsc/src/launcher/internal/runtime/withRuntimeDirectoryLock";

/**
 * Verifies default clean cannot remove a newly pinned index before its claim.
 *
 * A linked `project` index was pinned under one runtime lock, then the owner
 * was published under another. Clean between the two saw an empty index and
 * removed the runtime root. The later claim went into the old physical index,
 * unreachable by the next run's sweep.
 *
 * 1. Prepare a run below a linked index and inject the real default-clean target
 *    decision immediately after the first lock transaction.
 * 2. Remove only the test-owned targets that clean selected.
 * 3. Assert clean selected nothing and the claimed run remains reachable.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the authored claimRuntimeProjectDirectory with a declared lock operation that actually executes withRuntimeDirectoryLock, then runs the real default-clean target decision immediately after its first completed transaction. The original injection, empty targets, run existence and linked-index reachability assertions remain.
 * @evidence contracts/testing.md#independent-expectations A published live owner must prevent default clean from selecting its index. The literal empty target list, existence and physical reachability are independent fixture observations; neither the claim result nor clean classification supplies an expected snapshot.
 * @evidence contracts/testing.md#distinguishing-cases The project index actually links to an external fixture directory, pinning the create-before-claim race. An intervening clean after the first transaction would select an unclaimed empty index, so the original four observations distinguish a split publication transaction from an atomic claim. This case does not claim scheduler-level concurrent clean execution.
 * @evidence contracts/testing.md#execution-ownership This named source unit exercises actual filesystem pinning, process-owned records, runtime lock acquisition/release and cleanup classification in process. Its supplied lock operation delegates to the real lock and performs the observation after release; it patches no compiled export, builds no compiler and launches no worker. Finally relinquishes the live claim under the real lock and removes only the owned fixture.
 */
export function test_runtime_claim_precedes_clean(): void {
  const root = TestProject.tmpdir("ttsx-atomic-claim-");
  const project = path.join(root, "project");
  const cacheRoot = path.join(root, "cache", "ttsc");
  const runtime = path.join(cacheRoot, "ttsx");
  const physicalRuns = path.join(root, "external-runs");
  TestProject.writeFiles(project, {
    "package.json": JSON.stringify({ private: true }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        module: "commonjs",
        outDir: "lib",
        target: "ES2022",
        types: [],
      },
      include: ["src"],
    }),
    "src/main.ts": "export const value = 1;\n",
  });
  fs.mkdirSync(runtime, { recursive: true });
  fs.mkdirSync(physicalRuns);
  fs.symlinkSync(
    physicalRuns,
    path.join(runtime, "project"),
    process.platform === "win32" ? "junction" : "dir",
  );

  const pinnedRuntime = fs.realpathSync.native(runtime);
  let claimed: string | undefined;
  let injected = false;
  let cleanTargets: string[] = [];
  const handoff: typeof withRuntimeDirectoryLock = (location, work) => {
    const answer = withRuntimeDirectoryLock(location, work);
    if (!injected) {
      injected = true;
      assert.equal(path.resolve(location), pinnedRuntime, "wrong runtime lock");
      const plan = resolveRuntimeCleanTargets(cacheRoot);
      cleanTargets = plan.targets;
      for (const target of resolveSafeCacheCleanupTargets(
        project,
        plan.targets,
      )) {
        if (!target.exists) continue;
        const physicalRoot = fs.realpathSync.native(root);
        const relative = path.relative(
          physicalRoot,
          fs.realpathSync.native(target.path),
        );
        assert.ok(
          relative !== "" &&
            relative !== ".." &&
            !relative.startsWith(`..${path.sep}`) &&
            !path.isAbsolute(relative),
          "clean selected a target outside the owned fixture",
        );
        fs.rmSync(target.path, { recursive: true, force: true });
      }
    }
    return answer;
  };
  try {
    claimed = claimRuntimeProjectDirectory(
      pinnedRuntime,
      runtimeRunKey(),
      handoff,
    );
    const report = {
      injected,
      cleanTargets,
      runExists: fs.existsSync(claimed),
      runReachable: fs.existsSync(
        path.join(runtime, "project", path.basename(claimed)),
      ),
    };
    assert.equal(report.injected, true, "the clean handoff was not exercised");
    assert.deepEqual(
      report.cleanTargets,
      [],
      "clean pruned the unclaimed index",
    );
    assert.equal(report.runExists, true);
    assert.equal(report.runReachable, true, "the claimed run was orphaned");
  } finally {
    if (claimed !== undefined) {
      withRuntimeDirectoryLock(pinnedRuntime, () =>
        ProcessOwnedDirectory.relinquish(claimed!),
      );
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
}
