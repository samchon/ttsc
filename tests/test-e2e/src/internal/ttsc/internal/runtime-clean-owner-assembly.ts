import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { isOrdinarilyClosedReadonlyLauncher } from "../../../../../utils/src/isOrdinarilyClosedReadonlyLauncher";
import { isolatedCacheEnvironment } from "./isolated-cache-environment";
import { runtimeRunsDirectory } from "./ttsx-run";

/**
 * Verifies public clean connects conservative runtime ownership to effects. The
 * caller supplies its already owned, declared-workspace canonical root, after
 * all native children have joined and every cache reader has finished. Authored
 * legacy and malformed records have no deletion authority. Explicit cache
 * selection is the independent force-delete counterpart. A real seed child
 * first leaves an acquired lock; native ESRCH and public clean removal retain
 * the dead-holder recovery connection. This helper starts three actual clean
 * CLI children plus that seed and no compiler, allocates no project, and must not
 * run against a root whose caches still belong to a live reader. Unknown launch
 * metadata stops another clean request and retains the root; the optional
 * caller callback retains any other artifact inputs.
 *
 * @evidence contracts/common.md#principled-implementation Authored legacy and malformed records contrast conservative default ownership planning with explicit selected-cache deletion, and the actual CLI performs and reports both effects.
 * @evidence contracts/common.md#clear-and-simple-design One completed canonical root owns dead-lock recovery and the two conservative/explicit commands; no new project or compiler producer is acquired.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual command children and scoped environment preserve default production operations; no foreign stream, global environment or cleanup operation is replaced.
 * @evidence contracts/common.md#meaningful-documentation Describes joined readers, declared workspace authority, selected completed cache retirement and the limitation to conservative ownership assembly.
 * @evidence contracts/portability.md#os-neutral-implementation Path operations address owned directories and real CLI children run through TestProject; child-only home and temporary paths contain legacy cleanup across supported hosts.
 * @evidence contracts/performance.md#efficient-algorithms Constant-count fixture writes and assertions surround two CLI effects, plus one seed and one recovery command when the consolidated caller selects dead-lock recovery; target traversal remains with production.
 * @evidence contracts/performance.md#reuse-equivalent-work Both commands share the canonical workspace and tool artifacts, while explicit force deletion is a changed authority and cannot reuse the default cleanup result.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Synchronous children return before the next phase; the optional seed additionally requires ESRCH-only native absence before recovery. Uncertain receipts or liveness retain the root and block mutation. The parent owns completed cache lifetime and the finite failure collection.
 *
 * @evidence contracts/testing.md#behavioral-verification The public default clean preserves two independently authored unproven-owner runs and reports kept state; explicit selected-cache clean removes both after all preservation observations.
 * @evidence contracts/testing.md#independent-expectations Original literal existence, kept and nonempty-report expectations accompany actual status values; no output snapshot supplies its own oracle.
 * @evidence contracts/testing.md#distinguishing-cases Actual exited lock holder contrasts with missing and malformed run owners. Explicit whole-cache deletion contrasts with conservative default cleanup; native ESRCH is required rather than a simulated dead pid.
 * @evidence contracts/testing.md#execution-ownership A parent canonical discoverable E2E entry calls this helper only after its readers and descendants finish. It uses real public CLI children, actual filesystem records and scoped child environment; no global stream or environment is replaced.
 * @evidence contracts/e2e.md#necessary-boundary Actual command dispatch, default runtime locking, ownership plan, safe removal and public reports must remain connected. Source resolver results alone cannot prove these effects.
 * @evidence contracts/e2e.md#shared-execution The existing canonical root and installation boundary own both clean operations; no additional authored project or compiler producer is created.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The caller owns the whole cache and declares its workspace boundary. Legacy machine paths resolve into this fixture through child-only environment. Invocation occurs after cache reuse ends; explicit cleanup intentionally retires the completed canonical cache.
 * @evidence contracts/e2e.md#preserved-coverage Original acquired-lock seed success, public clean success and abandoned runtime removal join all eight legacy/malformed assertions. Native ESRCH strengthens the actual dead-holder premise; live-holder exclusion and successor fencing remain separate owners.
 */
export function verifyRuntimeCleanOwnerAssembly(
  root: string,
  onUnresolved?: (reason: string) => void,
  includeDeadLockRecovery = false,
): void {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  ) as { workspaces?: unknown };
  const workspacePackages = Array.isArray(manifest.workspaces)
    ? manifest.workspaces
    : manifest.workspaces !== null && typeof manifest.workspaces === "object"
      ? (manifest.workspaces as { packages?: unknown }).packages
      : undefined;
  assert.ok(
    Array.isArray(workspacePackages) && workspacePackages.length > 0,
    "canonical root must declare a nonempty workspace boundary",
  );
  const runs = runtimeRunsDirectory(root);
  const directory = path.join(runs, "legacy");
  const unknown = path.join(runs, "unknown");
  assert.equal(
    fs.existsSync(directory),
    false,
    "legacy stage must own a fresh name",
  );
  assert.equal(
    fs.existsSync(unknown),
    false,
    "malformed stage must own a fresh name",
  );
  const env = isolatedCacheEnvironment(root);
  const failures: Error[] = [];
  const check = (name: string, work: () => void): void => {
    try {
      work();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  const unresolved = (cause: unknown): never => {
    const reason = "BLOCKED: clean launcher completion is unresolved";
    for (const retain of [
      () => TestProject.retainTemporaryDirectory(root, reason),
      () => onUnresolved?.(reason),
    ])
      try {
        retain();
      } catch (error) {
        failures.push(
          new Error("retain unresolved clean inputs", { cause: error }),
        );
      }
    throw new AggregateError([...failures, cause], reason);
  };
  const launch = (args: string[]) => {
    let result: ReturnType<typeof TestProject.spawn>;
    try {
      result = TestProject.spawn(TestProject.TTSC_BIN, args, {
        cwd: root,
        env,
      });
    } catch (cause) {
      return unresolved(cause);
    }
    if (!isOrdinarilyClosedReadonlyLauncher(result))
      unresolved(
        result.error ??
          new Error(
            `clean receipt status=${result.status} signal=${result.signal} pid=${result.pid}`,
          ),
      );
    return result;
  };
  if (includeDeadLockRecovery) {
    const runtime = path.dirname(runs);
    fs.mkdirSync(runtime, { recursive: true });
    const lockDir = `${fs.realpathSync.native(runtime)}.lock`;
    const acquire = path.join(TestProject.WORKSPACE_ROOT, "packages", "ttsc", "lib",
      "launcher", "internal", "runtime", "acquireDependencyBuildLock.js");
    const worker = path.join(root, "acquire-lock.cjs");
    assert.equal(fs.existsSync(worker), false, "lock seed owns a fresh script name");
    fs.writeFileSync(worker, [
      `const { acquireDependencyBuildLock } = require(${JSON.stringify(acquire)});`,
      `if (acquireDependencyBuildLock(${JSON.stringify(lockDir)}) === null) {`,
      '  throw new Error("the lock was not acquired");',
      "}",
      "",
    ].join("\n"), "utf8");
    let held: ReturnType<typeof TestProject.spawn>;
    try { held = TestProject.spawn(process.execPath, [worker], { cwd: root }); }
    catch (cause) { return unresolved(cause); }
    if (!isOrdinarilyClosedReadonlyLauncher(held)) unresolved(
      held.error ?? new Error(`lock seed receipt status=${held.status} signal=${held.signal} pid=${held.pid}`),
    );
    assert.equal(held.status, 0, held.stderr);
    let dead = false;
    try { process.kill(held.pid, 0); }
    catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === "ESRCH") dead = true;
      else unresolved(cause);
    }
    if (!dead) unresolved(new Error("lock seed PID remains live or was reused"));
    const recovered = launch(["clean", "--cwd", root]);
    check("dead lock clean status", () => assert.equal(recovered.status, 0, recovered.stderr));
    check("abandoned runtime removed", () => assert.equal(fs.existsSync(runtime), false, recovered.stdout));
    // Only these completed public effects may precede the unproven-owner inputs.
    if (failures.length) throw new AggregateError(failures, "dead runtime lock recovery failed");
  }
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "main.js"), "", "utf8");
  fs.mkdirSync(unknown);
  fs.writeFileSync(path.join(unknown, "owner-12.json"), "{", "utf8");
  const ordinary = launch(["clean", "--cwd", root]);
  check("ordinary clean status", () =>
    assert.equal(ordinary.status, 0, ordinary.stderr),
  );
  check("legacy preserved", () =>
    assert.equal(fs.existsSync(directory), true, ordinary.stdout),
  );
  check("malformed preserved", () =>
    assert.equal(fs.existsSync(unknown), true, ordinary.stdout),
  );
  check("kept report", () => assert.match(ordinary.stdout, /ttsc: kept /));
  check("nonempty cache report", () =>
    assert.doesNotMatch(ordinary.stdout, /no cache directories found/),
  );
  const cacheRoot = path.dirname(path.dirname(runs));
  const explicit = launch(["clean", "--cwd", root, "--cache-dir", cacheRoot]);
  check("explicit clean status", () =>
    assert.equal(explicit.status, 0, explicit.stderr),
  );
  check("legacy removed", () => assert.equal(fs.existsSync(directory), false));
  check("malformed removed", () => assert.equal(fs.existsSync(unknown), false));
  if (failures.length)
    throw new AggregateError(failures, "runtime clean assembly failed");
}
