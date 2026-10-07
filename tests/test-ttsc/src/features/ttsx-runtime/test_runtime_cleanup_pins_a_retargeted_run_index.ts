import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolveSafeCacheCleanupTargets } from "../../../../../packages/ttsc/src/internal/resolveSafeCacheCleanupTargets";
import { ProcessOwnedDirectory } from "../../../../../packages/ttsc/src/launcher/internal/runtime/ProcessOwnedDirectory";
import { resolveRuntimeCleanTargets } from "../../../../../packages/ttsc/src/launcher/internal/runtime/resolveRuntimeCleanTargets";
import { TestProject } from "../../../../utils/src/TestProject";

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
 * @evidence contracts/testing.md#independent-expectations An owned child exits with status zero and its native probe must return ESRCH; the current PID is independently probed live. Literal original paths and victim bytes define expectations independently of the product's ownership classifier. PID reuse causes bounded preparation retry, never fabricated death.
 * @evidence contracts/testing.md#distinguishing-cases The clean plan retains a live sibling while selecting a dead sibling; a separate sweep retargets immediately after listing and must not follow the alias to a same-named victim.
 * @evidence contracts/testing.md#execution-ownership This matching source-unit entry imports authored owners directly. At most eight inert owned child completions prepare a genuinely absent PID; no compiler, installed artifact or product host is started. The supported sweep selection callback retargets only the fixture alias after enumeration. Native junction/symlink preparation failures are not skipped or claimed as product failures; TestProject owns temporary cleanup.
 */
export function test_runtime_cleanup_pins_a_retargeted_run_index(): void {
  const root = TestProject.tmpdir("ttsx-run-index-retarget-");
  const project = path.join(root, "project");
  const cache = path.join(root, "cache");
  const runs = path.join(cache, "ttsx", "project");
  const original = path.join(root, "original");
  const victim = path.join(root, "victim");
  const deadPid = endedProcessId();
  process.kill(process.pid, 0);
  const failures: Error[] = [];
  const check = (name: string, verify: () => void): void => {
    try {
      verify();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  check("default clean retarget scenario", () => {
    fs.mkdirSync(project);
    fs.mkdirSync(path.dirname(runs), { recursive: true });
    recordOwner(path.join(original, "stale"), deadPid);
    recordOwner(path.join(original, "live"), process.pid);
    recordOwner(path.join(victim, "stale"), process.pid);
    fs.writeFileSync(path.join(victim, "stale", "keep.txt"), "victim");
    fs.symlinkSync(original, runs, linkKind());

    const plan = resolveRuntimeCleanTargets(cache);
    check("live sibling retained", () => {
      assert.equal(plan.kept.length, 1);
      assert.deepEqual(plan.kept, [
        path.join(fs.realpathSync.native(original), "live"),
      ]);
    });
    replaceLink(runs, victim);
    const safe = resolveSafeCacheCleanupTargets(project, plan.targets);
    const originalTarget = path.join(fs.realpathSync.native(original), "stale");
    const plannedCorrectly = safe.some(
      (target) => target.path === originalTarget,
    );
    check("physical cleanup target preserved", () =>
      assert.equal(
        plannedCorrectly,
        true,
        `clean selected ${safe.map((target) => target.path).join(", ")}`,
      ),
    );
  });

  check("sweep after-enumeration retarget scenario", () => {
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
    check("after-enumeration retarget exercised", () =>
      assert.equal(switched, true, "the sweep retarget was not exercised"),
    );
    check("original abandoned run removed", () =>
      assert.equal(fs.existsSync(path.join(sweepOriginal, "stale")), false),
    );
    check("same-named victim bytes preserved", () =>
      assert.equal(
        fs.readFileSync(path.join(sweepVictim, "stale", "keep.txt"), "utf8"),
        "victim",
      ),
    );
  });
  if (failures.length)
    throw new AggregateError(
      failures,
      "runtime index retarget assertions failed",
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
  for (let attempt = 0; attempt < 8; attempt++) {
    const child = childProcess.spawnSync(process.execPath, ["-e", ""], {
      windowsHide: true,
    });
    assert.equal(child.status, 0, child.stderr?.toString());
    assert.ok(child.pid);
    try {
      process.kill(child.pid, 0);
    } catch (error) {
      assert.equal(
        (error as NodeJS.ErrnoException).code,
        "ESRCH",
        "departed PID preparation must establish absence",
      );
      return child.pid;
    }
  }
  throw new Error(
    "native preparation could not establish an absent owned child PID",
  );
}
