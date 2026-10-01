import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  assert,
  fs,
  goPath,
  path,
  setupLintProject,
  spawn,
  ttscBin,
} from "../../../../internal/ttsc/internal/plugin-corpus";
import { WatchSession } from "../../../../internal/ttsc/internal/watch";

type ResidentSample = {
  pid: number;
  programLoads: number;
  programUpdates: number;
  reused: boolean;
};

/**
 * Verifies real `ttsc --noEmit --watch` reuses the lint sidecar and Program
 * only across compatible source edits.
 *
 * The diagnostics stream is ordinary product telemetry. It proves the child PID
 * and Program load count remain stable while updates advance, then proves a
 * root-set transition selects a fresh Program. A cold check of the edited
 * filesystem remains the correctness oracle rather than a fixture-specific
 * expected answer.
 *
 * 1. Start a failing no-var watch and record its first resident sample.
 * 2. Repair the known source, require one incremental sample, and compare the
 *    clean state with a cold one-shot check.
 * 3. Reintroduce the finding and require the same PID/load with another update.
 * 4. Edit tsconfig and require a fresh sidecar.
 * 5. Add and remove a TypeScript root, requiring a full reload each time.
 * 6. Shut down and prove the final resident sidecar was disposed.
 *
 * @evidence contracts/testing.md#behavioral-verification Real watch preserves one PID/load across compatible source edits, replaces PID/Program after config/root-set changes, disposes the last child and passes a clean cold check.
 * @evidence contracts/testing.md#independent-expectations Literal load/update/reuse tables and distinct PID requirements express the resident protocol; the final const source has no configured no-var error and independently requires a successful one-shot check.
 * @evidence contracts/testing.md#distinguishing-cases Owns source repair/reintroduction, tsconfig change, TypeScript root addition/removal and shutdown, while JSON membership and executable contributor changes have separate actual boundary owners.
 * @evidence contracts/testing.md#execution-ownership The matching named corpus-misc export runs one actual WatchSession and a final one-shot check in the shared Linux native batch.
 * @evidence contracts/e2e.md#necessary-boundary Filesystem transitions must reach the real resident engine and select compatible reuse or fresh process startup, then close the final process; direct state-decision units cannot prove live PID and transport lifetime.
 * @evidence contracts/e2e.md#shared-execution All six watch cycles share one consumer and unchanged lint producer through the batch cache; new processes are observed only for incompatible config/root changes, and the final one-shot check is the explicit clean-state control.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fixture alone owns mutable source/config/root membership, finally closes the watcher and a bounded native PID check confirms disposal; shared native artifacts contain no consumer Program state.
 * @evidence contracts/e2e.md#preserved-coverage Original six sample cardinalities/counter tables, fresh-sample checks, final PID disposal and cold status-zero assertions remain. Telemetry does not independently certify every diagnostic body and the prose makes no stronger comparison claim.
 */
export async function test_plugin_corpus_check_watch_reuses_resident_program(): Promise<void> {
  const root = setupLintProject("lint-violations");
  const source = path.join(root, "src", "main.ts");
  fs.writeFileSync(
    path.join(root, "lint.config.json"),
    JSON.stringify({ rules: { "no-var": "error" } }),
  );
  fs.writeFileSync(
    source,
    "var legacy = 1;\nJSON.stringify(legacy);\n",
    "utf8",
  );
  const session = new WatchSession(root, {
    args: ["--noEmit", "--diagnostics"],
    env: {
      PATH: goPath(),
      TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
    },
  });
  try {
    await session.waitForBuilds(1, 300_000);
    let samples = residentSamples(session.transcript());
    assert.equal(samples.length, 1, session.transcript());
    assert.deepEqual(samples[0], {
      pid: samples[0]!.pid,
      programLoads: 1,
      programUpdates: 0,
      reused: false,
    });

    fs.writeFileSync(
      source,
      "const modern = 1;\nJSON.stringify(modern);\n",
      "utf8",
    );
    await session.waitForBuilds(2);
    samples = residentSamples(session.transcript());
    assert.equal(samples.length, 2, session.transcript());
    assert.deepEqual(samples[1], {
      pid: samples[0]!.pid,
      programLoads: 1,
      programUpdates: 1,
      reused: true,
    });
    fs.writeFileSync(
      source,
      "var legacy = 1;\nJSON.stringify(legacy);\n",
      "utf8",
    );
    await session.waitForBuilds(3);
    samples = residentSamples(session.transcript());
    assert.equal(samples.length, 3, session.transcript());
    assert.deepEqual(samples[2], {
      pid: samples[0]!.pid,
      programLoads: 1,
      programUpdates: 2,
      reused: true,
    });

    const tsconfig = path.join(root, "tsconfig.json");
    const config = JSON.parse(fs.readFileSync(tsconfig, "utf8")) as {
      compilerOptions: Record<string, unknown>;
    };
    config.compilerOptions.noUnusedLocals = false;
    fs.writeFileSync(tsconfig, JSON.stringify(config), "utf8");
    await session.waitForBuilds(4);
    samples = residentSamples(session.transcript());
    assert.equal(samples.length, 4, session.transcript());
    assertFreshSample(samples[3]!, samples[2]!.pid);

    const added = path.join(root, "src", "added.ts");
    fs.writeFileSync(added, "export const added = true;\n", "utf8");
    await session.waitForBuilds(5);
    samples = residentSamples(session.transcript());
    assert.equal(samples.length, 5, session.transcript());
    assertFreshSample(samples[4]!, samples[3]!.pid);

    fs.rmSync(added);
    await session.waitForBuilds(6);
    samples = residentSamples(session.transcript());
    assert.equal(samples.length, 6, session.transcript());
    assertFreshSample(samples[5]!, samples[4]!.pid);
  } finally {
    await session.close();
  }
  const finalPid = residentSamples(session.transcript()).at(-1)?.pid;
  assert.notEqual(finalPid, undefined, session.transcript());
  await waitForProcessExit(finalPid!);
  fs.writeFileSync(
    source,
    "const modern = 1;\nJSON.stringify(modern);\n",
    "utf8",
  );
  const cold = spawn(ttscBin, ["--noEmit", "--cwd", root], {
    cwd: root,
    env: {
      PATH: goPath(),
      TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
    },
  });
  assert.equal(cold.status, 0, cold.stderr);
}

function assertFreshSample(sample: ResidentSample, previousPid: number): void {
  assert.notEqual(sample.pid, previousPid);
  assert.equal(sample.programLoads, 1);
  assert.equal(sample.programUpdates, 0);
  assert.equal(sample.reused, false);
}

async function waitForProcessExit(pid: number): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (processIsAlive(pid)) {
    if (Date.now() >= deadline) {
      assert.fail(`resident check sidecar ${String(pid)} survived watch close`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function residentSamples(transcript: string): ResidentSample[] {
  return [
    ...transcript.matchAll(
      /@ttsc\/lint resident check: pid=(\d+) programLoads=(\d+) programUpdates=(\d+) reused=(true|false)/g,
    ),
  ].map((match) => ({
    pid: Number(match[1]),
    programLoads: Number(match[2]),
    programUpdates: Number(match[3]),
    reused: match[4] === "true",
  }));
}
