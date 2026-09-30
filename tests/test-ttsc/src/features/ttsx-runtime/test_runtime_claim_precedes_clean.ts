import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

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
 * @evidence contracts/testing.md#behavioral-verification prepareExecution is called in a worker with a handoff after the first real runtime lock transaction; assertions require injection, an empty clean plan and an existing reachable generation.
 * @evidence contracts/testing.md#independent-expectations A newly prepared live owner must prevent default clean from selecting its index; the empty target list and physical reachability are independently observable fixture facts.
 * @evidence contracts/testing.md#distinguishing-cases The linked external index pins the create-before-claim race; clean selection after the first lock would distinguish a split transaction from one atomic claim transaction.
 * @evidence contracts/testing.md#execution-ownership The named E2E entry reaches the built preparation pipeline, real compiler and fixture-only worker; the injected clean decision is not a separate public clean invocation. The worker replaces the compiled lock export, a prohibited foreign-internal patch that remains unresolved.
 * @evidence contracts/e2e.md#necessary-boundary The connection joins native preparation, owner publication and the runtime lock with actual linked filesystem state; portable cleanup classification alone cannot prove this call ordering.
 * @evidence contracts/e2e.md#shared-execution One worker loads one project and performs one preparation; the clean target decision is injected into that same lifetime rather than recompiling in a second host.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A dedicated cache and external index isolate the mutation; only fixture-owned safe targets may be deleted. The worker ends normally but its prepared directory is retained for fixture cleanup, not explicitly released here.
 * @evidence contracts/e2e.md#preserved-coverage Injection, no selected targets, generation existence and index reachability all remain here; this case does not assert scheduler-level concurrent clean execution.
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

  const worker = path.join(project, "claim-worker.cjs");
  const moduleRoot = path.join(
    TestProject.WORKSPACE_ROOT,
    "packages",
    "ttsc",
    "lib",
  );
  fs.writeFileSync(
    worker,
    [
      'const fs = require("node:fs");',
      'const path = require("node:path");',
      `const project = ${JSON.stringify(project)};`,
      `const cacheRoot = ${JSON.stringify(cacheRoot)};`,
      `const runtime = ${JSON.stringify(runtime)};`,
      `const source = ${JSON.stringify(path.join(project, "src", "main.ts"))};`,
      `const locks = require(${JSON.stringify(path.join(moduleRoot, "launcher", "internal", "runtime", "withRuntimeDirectoryLock.js"))});`,
      `const { resolveRuntimeCleanTargets } = require(${JSON.stringify(path.join(moduleRoot, "launcher", "internal", "runtime", "resolveRuntimeCleanTargets.js"))});`,
      `const { resolveSafeCacheCleanupTargets } = require(${JSON.stringify(path.join(moduleRoot, "internal", "resolveSafeCacheCleanupTargets.js"))});`,
      "const original = locks.withRuntimeDirectoryLock;",
      "let injected = false;",
      "let cleanTargets = [];",
      "locks.withRuntimeDirectoryLock = (location, work) => {",
      "  const answer = original(location, work);",
      "  if (!injected) {",
      "    injected = true;",
      '    if (path.resolve(location) !== fs.realpathSync.native(runtime)) throw new Error("wrong runtime lock");',
      "    const plan = resolveRuntimeCleanTargets(cacheRoot);",
      "    cleanTargets = plan.targets;",
      "    for (const target of resolveSafeCacheCleanupTargets(project, plan.targets)) {",
      "      if (target.exists) fs.rmSync(target.path, { recursive: true, force: true });",
      "    }",
      "  }",
      "  return answer;",
      "};",
      `const { prepareExecution } = require(${JSON.stringify(path.join(moduleRoot, "launcher", "internal", "prepareExecution.js"))});`,
      "const execution = prepareExecution(source, { cwd: project });",
      "process.stdout.write(JSON.stringify({",
      "  injected,",
      "  cleanTargets,",
      "  runExists: fs.existsSync(execution.cleanupDir),",
      '  runReachable: fs.existsSync(path.join(runtime, "project", path.basename(execution.cleanupDir))),',
      "}));",
      "",
    ].join("\n"),
    "utf8",
  );

  const result = TestProject.spawn(process.execPath, [worker], {
    cwd: project,
    env: { TTSC_CACHE_DIR: cacheRoot },
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout) as {
    injected: boolean;
    cleanTargets: string[];
    runExists: boolean;
    runReachable: boolean;
  };
  assert.equal(report.injected, true, "the clean handoff was not exercised");
  assert.deepEqual(report.cleanTargets, [], "clean pruned the unclaimed index");
  assert.equal(report.runExists, true);
  assert.equal(report.runReachable, true, "the claimed run was orphaned");
}
