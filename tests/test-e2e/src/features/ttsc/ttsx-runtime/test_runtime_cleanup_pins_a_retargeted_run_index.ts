import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolveSafeCacheCleanupTargets } from "../../../../../../packages/ttsc/lib/internal/resolveSafeCacheCleanupTargets.js";
import { ProcessOwnedDirectory } from "../../../../../../packages/ttsc/lib/launcher/internal/runtime/ProcessOwnedDirectory.js";
import { resolveRuntimeCleanTargets } from "../../../../../../packages/ttsc/lib/launcher/internal/runtime/resolveRuntimeCleanTargets.js";

/**
 * Verifies runtime cleanup keeps one physical run index through a link change.
 *
 * An index can be a symlink or junction. Reading an owner through its lexical
 * spelling and resolving the deletion target later lets a retarget select a
 * different same-named run. Both default clean and next-run sweeping must pin
 * the index before inspecting any owner.
 *
 * 1. Plan default clean against an index holding a dead and a live run, then
 *    retarget the index and assert the deletion target remains the original.
 * 2. Retarget another index just after its directory is listed for sweeping.
 * 3. Assert the original dead run is swept and the victim's data survives.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveRuntimeCleanTargets and resolveSafeCacheCleanupTargets must retain the original physical stale target; ProcessOwnedDirectory.sweep must delete the original stale run while preserving victim bytes after retargeting.
 * @evidence contracts/testing.md#independent-expectations A real exited PID establishes abandonment, the current PID establishes liveness and literal victim bytes establish preservation independently of the path-selection implementation.
 * @evidence contracts/testing.md#distinguishing-cases The clean plan retains a live sibling while selecting a dead sibling; a separate sweep retargets immediately after listing and must not follow the alias to a same-named victim.
 * @evidence contracts/testing.md#execution-ownership This named feature entry currently imports built owner functions directly and uses one child to obtain genuine dead-process evidence and the supported sweep selection callback to retarget only its own alias after enumeration.
 * @evidence contracts/e2e.md#necessary-boundary The actual process-liveness probe, owner records, native symlink or junction and physical deletion must connect without retargeting deletion into a same-named victim; no compiler or installed CLI is required.
 * @evidence contracts/e2e.md#shared-execution One genuine departed PID is shared by both fixture scenarios, with no native build or product host; moving portable owners to source units must preserve that evidence rather than invent a dead PID.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Separate original/victim trees retain distinct bytes across both retargets; the supported accepts callback changes only the fixture alias after actual enumeration and before owner inspection. No foreign method is replaced; TestProject owns the temporary trees.
 * @evidence contracts/e2e.md#preserved-coverage All kept-count, original-target, exercised-retarget, stale-removal and victim-byte assertions remain; the callback preserves the original after-enumeration counterexample without replacing filesystem methods.
 */
export function test_runtime_cleanup_pins_a_retargeted_run_index(): void {
  const root = TestProject.tmpdir("ttsx-run-index-retarget-");
  const project = path.join(root, "project");
  const cache = path.join(root, "cache");
  const runs = path.join(cache, "ttsx", "project");
  const original = path.join(root, "original");
  const victim = path.join(root, "victim");
  const deadPid = endedProcessId();
  fs.mkdirSync(project);
  fs.mkdirSync(path.dirname(runs), { recursive: true });
  recordOwner(path.join(original, "stale"), deadPid);
  recordOwner(path.join(original, "live"), process.pid);
  recordOwner(path.join(victim, "stale"), process.pid);
  fs.writeFileSync(path.join(victim, "stale", "keep.txt"), "victim");
  fs.symlinkSync(original, runs, linkKind());

  const plan = resolveRuntimeCleanTargets(cache);
  assert.equal(plan.kept.length, 1);
  replaceLink(runs, victim);
  const safe = resolveSafeCacheCleanupTargets(project, plan.targets);
  const originalTarget = path.join(fs.realpathSync.native(original), "stale");
  const plannedCorrectly = safe.some(
    (target) => target.path === originalTarget,
  );

  const sweepAlias = path.join(root, "sweep-alias");
  const sweepOriginal = path.join(root, "sweep-original");
  const sweepVictim = path.join(root, "sweep-victim");
  recordOwner(path.join(sweepOriginal, "stale"), deadPid);
  recordOwner(path.join(sweepVictim, "stale"), deadPid);
  fs.writeFileSync(path.join(sweepVictim, "stale", "keep.txt"), "victim");
  fs.symlinkSync(sweepOriginal, sweepAlias, linkKind());
  let switched = false;
  ProcessOwnedDirectory.sweep(sweepAlias, () => {
    if (!switched) {
      switched = true;
      replaceLink(sweepAlias, sweepVictim);
    }
    return true;
  });
  assert.equal(switched, true, "the sweep race was not exercised");
  assert.equal(
    plannedCorrectly,
    true,
    `clean selected ${safe.map((target) => target.path).join(", ")}`,
  );
  assert.equal(fs.existsSync(path.join(sweepOriginal, "stale")), false);
  assert.equal(
    fs.readFileSync(path.join(sweepVictim, "stale", "keep.txt"), "utf8"),
    "victim",
  );
}

function recordOwner(directory: string, pid: number): void {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, `owner-${pid}.json`),
    JSON.stringify({ hostname: os.hostname(), pid }),
  );
}

function replaceLink(alias: string, target: string): void {
  fs.rmSync(alias, { force: true, recursive: true });
  fs.symlinkSync(target, alias, linkKind());
}

function linkKind(): "dir" | "junction" {
  return process.platform === "win32" ? "junction" : "dir";
}

function endedProcessId(): number {
  for (;;) {
    const child = childProcess.spawnSync(process.execPath, ["-e", ""], {
      windowsHide: true,
    });
    assert.equal(child.status, 0, child.stderr?.toString());
    assert.ok(child.pid);
    try {
      process.kill(child.pid, 0);
    } catch {
      return child.pid;
    }
  }
}
