import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { DependencyBuildLockLease } from "../../../../../packages/ttsc/src/launcher/internal/runtime/DependencyBuildLockLease";
import { inspectDependencyBuildLock } from "../../../../../packages/ttsc/src/launcher/internal/runtime/inspectDependencyBuildLock";
import { reclaimDependencyBuildLock } from "../../../../../packages/ttsc/src/launcher/internal/runtime/reclaimDependencyBuildLock";
import { releaseDependencyBuildLock } from "../../../../../packages/ttsc/src/launcher/internal/runtime/releaseDependencyBuildLock";

/**
 * Preserves dead-owner recovery and successor fencing at actual source owners.
 *
 * One seed exits holding its generation. Two contenders observe that same
 * abandoned fence; gates admit A first, then B only after A retirement. A's
 * delayed finalizer must leave live B untouched before B releases normally.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual acquire/inspect/reclaim/releaseDependencyBuildLock operations run in the exited seed, live A/B workers and parent. Retains exact seed/ready/active/successor fences, A true/true versus B false/false and absent B lease, parent A reclaim true, delayed A release false, normal B release true/released state, stale seed reclaim and A release false, and seed/A/B retired tombstones.
 * @evidence contracts/testing.md#independent-expectations Native seed status0/signalnull/positivePID/ESRCH-only observation establishes absence separately from inspection. Authored gates preserve the original interleaving; real acquired leases and literal boolean/record/tombstone expectations establish fence authority without a copied implementation. PID reuse can fail preparation and is not process-incarnation proof.
 * @evidence contracts/testing.md#distinguishing-cases Both ready records must equal the dead seed before mutation; A wins while stale B cannot reclaim/acquire, parent retires A, B acquires a successor, live A's finalizer fails and B's finalizer succeeds. Finally opens all five original gates and settles both acquired contenders even after failure. These are three worker roles, not compiler or installed-host connections.
 * @evidence contracts/testing.md#execution-ownership Existing unit-loader synchronous source hooks load actual production TypeScript in three native Node workers. Owned seed/contender/package fixtures preserve original LF scripts except source-bound require extensions, with no fake library, product API, synthetic PID, foreign replacement, install or native compiler. Error/unknown child completion retains the private root; otherwise cleanup failure is aggregated. Timeouts request termination without certifying descendant cleanup or bounding native IO, and stdout/stderr captures have no explicit byte quota. Authored body is separate from actual selection/runtime/survival execution.
 */
export async function test_dependency_lock_corpus_preserves_dead_owner_and_successor_fencing(): Promise<void> {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-dependency-lock-corpus-"),
  );
  const lock = path.join(root, "entry.lock");
  const loader = new URL(
    "../../../../../config/register-unit-loader.mjs",
    import.meta.url,
  ).href;
  const apiDirectory = fileURLToPath(
    new URL(
      "../../../../../packages/ttsc/src/launcher/internal/runtime/",
      import.meta.url,
    ),
  );
  const fixtureDirectory = fileURLToPath(
    new URL("../../../fixtures/dependency-lock-corpus/", import.meta.url),
  );
  const env = { LOCK_ROOT: root, LOCK_API: apiDirectory };
  const failures: Error[] = [];
  let retainRoot = false;
  type Outcome = {
    status: number | null;
    signal: NodeJS.Signals | null;
    pid: number | undefined;
    stdout: string;
    stderr: string;
  };
  const workers: Promise<Outcome>[] = [];
  const check = (name: string, action: () => void): void => {
    try {
      action();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  const read = (name: string): unknown =>
    JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
  const readLease = (name: string): DependencyBuildLockLease => {
    const value = read(name);
    assert.ok(
      typeof value === "object" && value !== null && "generation" in value,
    );
    assert.ok(typeof value.generation === "string");
    return { ...value, generation: value.generation };
  };
  const open = (name: string): void => {
    fs.writeFileSync(path.join(root, name), "open\n");
  };
  const wait = async (name: string): Promise<void> => {
    const deadline = Date.now() + 60_000;
    while (!fs.existsSync(path.join(root, name))) {
      assert.ok(Date.now() <= deadline, `timed out waiting for ${name}`);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  };
  const start = (script: string, role?: string): Promise<Outcome> => {
    const result = new Promise<Outcome>((resolve, reject) => {
      const child = childProcess.spawn(
        process.execPath,
        ["--import", loader, path.join(root, script)],
        {
          env: {
            ...process.env,
            ...env,
            ...(role === undefined ? {} : { LOCK_ROLE: role }),
          },
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 120_000,
          windowsHide: true,
        },
      );
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.once("error", (cause) => {
        retainRoot = true;
        reject(cause);
      });
      child.once("close", (status, signal) => {
        if (status === null && signal === null) retainRoot = true;
        resolve({ status, signal, pid: child.pid, stdout, stderr });
      });
    });
    // Preserve rejected worker outcomes for allSettled without an unhandled interval.
    void result.catch(() => undefined);
    return result;
  };
  try {
    for (const name of ["seed.cjs", "contender.cjs", "package.json"])
      fs.copyFileSync(path.join(fixtureDirectory, name), path.join(root, name));
    try {
      const seedResult = await start("seed.cjs");
      assert.equal(seedResult.status, 0, seedResult.stderr);
      assert.equal(seedResult.signal, null, seedResult.stderr);
      const seedPid = seedResult.pid;
      assert.ok(
        seedPid !== undefined && Number.isInteger(seedPid) && seedPid > 0,
      );
      assert.throws(() => process.kill(seedPid, 0), { code: "ESRCH" });
      const seed = readLease("seed.json");
      check("dead seed", () => {
        const observation = inspectDependencyBuildLock(lock, Date.now());
        assert.equal(observation.state, "abandoned");
        assert.deepEqual(
          observation.state === "abandoned" ? observation.fence : null,
          seed,
        );
      });
      workers.push(start("contender.cjs", "a"), start("contender.cjs", "b"));
      await Promise.all([wait("a-ready.json"), wait("b-ready.json")]);
      for (const role of ["a", "b"])
        check(role + " ready fence", () =>
          assert.deepEqual(read(role + "-ready.json"), seed),
        );
      open("a-start");
      await wait("a-lease.json");
      const old = readLease("a-lease.json");
      open("b-start");
      await wait("b-observed.json");
      check("one stale winner", () => {
        assert.deepEqual(read("a-observed.json"), {
          reclaimed: true,
          holding: true,
        });
        assert.deepEqual(read("b-observed.json"), {
          reclaimed: false,
          holding: false,
        });
        assert.equal(fs.existsSync(path.join(root, "b-lease.json")), false);
        const active = inspectDependencyBuildLock(lock, Date.now());
        assert.equal(active.state, "active");
        assert.deepEqual(active.state === "active" ? active.fence : null, old);
        assert.equal(
          fs.existsSync(path.join(lock, "retired", seed.generation)),
          true,
        );
      });
      assert.equal(reclaimDependencyBuildLock(lock, old), true);
      open("b-successor");
      await wait("b-lease.json");
      const successor = readLease("b-lease.json");
      open("a-finalize");
      await wait("a-result.json");
      check("late old finalizer", () => {
        assert.deepEqual(read("a-result.json"), { released: false });
        const active = inspectDependencyBuildLock(lock, Date.now());
        assert.equal(active.state, "active");
        assert.deepEqual(
          active.state === "active" ? active.fence : null,
          successor,
        );
      });
      open("b-finalize");
      await Promise.all(workers);
      check("normal successor release", () => {
        assert.deepEqual(read("b-result.json"), { released: true });
        assert.deepEqual(inspectDependencyBuildLock(lock, Date.now()), {
          state: "released",
        });
        assert.equal(reclaimDependencyBuildLock(lock, seed), false);
        assert.equal(releaseDependencyBuildLock(lock, old), false);
        for (const lease of [seed, old, successor])
          assert.equal(
            fs.existsSync(path.join(lock, "retired", lease.generation)),
            true,
          );
      });
    } catch (cause) {
      failures.push(
        new Error("dependency lock corpus native ordering", { cause }),
      );
    } finally {
      for (const gate of [
        "a-start",
        "b-start",
        "b-successor",
        "a-finalize",
        "b-finalize",
      ])
        check(`finally opens ${gate}`, () => open(gate));
      const outcomes = await Promise.allSettled(workers);
      for (const [index, outcome] of outcomes.entries()) {
        if (outcome.status === "rejected") {
          failures.push(
            new Error(`worker ${index} completion`, { cause: outcome.reason }),
          );
          continue;
        }
        check(`worker ${index} exit`, () => {
          assert.equal(outcome.value.status, 0, outcome.value.stderr);
          assert.equal(outcome.value.signal, null, outcome.value.stderr);
        });
      }
    }
  } catch (cause) {
    failures.push(
      new Error("dependency lock corpus fixture preparation", { cause }),
    );
  } finally {
    if (retainRoot)
      console.error("unresolved dependency lock worker inputs retained", root);
    else
      check("dependency lock corpus root cleanup", () =>
        fs.rmSync(root, { recursive: true, force: true }),
      );
  }
  if (failures.length !== 0)
    throw new AggregateError(
      failures,
      "dependency lock corpus observations failed",
    );
}
