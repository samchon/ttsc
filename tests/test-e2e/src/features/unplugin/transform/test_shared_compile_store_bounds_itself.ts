import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { TtscSharedCompilePublication } from "../../../../../../packages/unplugin/lib/core/transform/session/TtscSharedCompilePublication.mjs";
import { claimSharedCompile } from "../../../../../../packages/unplugin/lib/core/transform/session/claimSharedCompile.mjs";

/**
 * Verifies the shared compile store keeps the most recently used publications
 * of each identity and of the whole store, and removes what workers that are
 * gone left behind (samchon/ttsc#1483).
 *
 * The store outlives every process that uses it, so a restarted dev server
 * adopts what the last one compiled. Without a bound it would keep every
 * identity a project ever had, those of an older ttsc among them, which can
 * never be adopted again, and the lock or partial write of every worker that
 * crashed.
 *
 * 1. Publish five states of one identity, adopting the oldest before the last
 *    publish, and assert the four most recently used are kept, the adopted one
 *    among them.
 * 2. Publish one state of each of 32 more identities, and assert the store keeps
 *    the 32 most recently used publications: the adopted state, used after
 *    every other was published, and the newest 31 of the others.
 * 3. Leave a lock and a partial write of a dead process, and a lock and a long
 *    running partial write of a live one, publish once more, and assert the
 *    dead process's are removed and the live one's stay.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls claimSharedCompile publish/adopt over a real store; asserts four most-recent states per identity, 32 store publications, deletion of a terminated process lock/partial write and preservation of this live process state.
 * @evidence contracts/testing.md#independent-expectations Published limits are explicit store policy and authored timestamps independently establish recency. A synchronous child provides a dead PID while process.pid supplies a live counterexample; these inputs do not derive cleanup expectations from its implementation.
 * @evidence contracts/testing.md#distinguishing-cases Owns fifth-state and thirty-third-publication eviction boundaries, adoption refreshing recency, live/dead ownership and an old still-live partial write.
 * @evidence contracts/testing.md#execution-ownership E2E entry connects built store cleanup with real OS PID liveness and filesystem timestamps, using one exited child. It builds no compiler/plugin and currently retains portable eviction assertions in that connection batch.
 * @evidence contracts/e2e.md#necessary-boundary Reclamation must consult actual process liveness, especially an old partial write that still belongs to a live writer. This real child/live-parent distinction is a necessary OS connection; recency calculations remain mixed portable semantics.
 * @evidence contracts/e2e.md#shared-execution One store batches all state/identity publications and one synchronous child supplies both dead lock and dead-write identities. Existing built packages are reused, and no per-publication installation or native host starts.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Authored monotonic stamps order publications and adopting the oldest deliberately refreshes its actual use time. Claims normally release each lock; live/dead leftovers have distinct names and TestProject removes the store at exit. Failed assertions can retain a claim until worker termination.
 * @evidence contracts/e2e.md#preserved-coverage Per-identity/global recency sets and every live/dead cleanup assertion remain. No eviction distinction is discarded; direct unit transfer of portable recency semantics remains outstanding rather than being certified by the liveness boundary.
 */
export async function test_shared_compile_store_bounds_itself(): Promise<void> {
  const store = TestProject.tmpdir("ttsc-unplugin-shared-bounds-");
  const publication: TtscSharedCompilePublication = {
    externalInputHashes: {},
    externalInputRealpaths: {},
    result: {
      type: "success",
      typescript: {},
    } as unknown as TtscSharedCompilePublication["result"],
    scratchDirectory: path.resolve("/scratch"),
  };
  const published = () =>
    fs
      .readdirSync(store)
      .filter((entry) => entry.endsWith(".json"))
      .sort();
  let clock = Date.now() - 1_000_000;
  /** Compile and publish one state, stamped after every earlier one. */
  const publish = async (identity: string, state: string) => {
    const claim = await claimSharedCompile(store, identity, state, {
      adopt: false,
    });
    assert.equal(claim?.kind, "compile");
    if (claim?.kind !== "compile") return;
    await claim.publish(publication);
    claim.release();
    const file = path.join(store, `${identity}-${state}.json`);
    if (fs.existsSync(file)) {
      clock += 1_000;
      fs.utimesSync(file, new Date(clock), new Date(clock));
    }
  };

  // 1. Four per identity, most recently used first.
  const identity = "a".repeat(32);
  const states = ["1", "2", "3", "4", "5"].map((digit) => digit.repeat(32));
  for (const state of states.slice(0, 4)) await publish(identity, state);
  const adopted = await claimSharedCompile(store, identity, states[0]!, {
    adopt: true,
  });
  assert.equal(adopted?.kind, "adopt", "the oldest state is adopted");
  await publish(identity, states[4]!);
  assert.deepEqual(
    published(),
    [states[0], states[2], states[3], states[4]].map(
      (state) => `${identity}-${state}.json`,
    ),
    "the least recently used state of the identity is gone",
  );

  // 2. Thirty-two in the whole store.
  const others = Array.from({ length: 32 }, (_, index) =>
    index.toString(16).padStart(32, "0"),
  );
  for (const other of others) await publish(other, "f".repeat(32));
  assert.deepEqual(
    published(),
    [
      `${identity}-${states[0]}.json`,
      ...others.slice(1).map((other) => `${other}-${"f".repeat(32)}.json`),
    ].sort(),
    "the least recently used publications of the store are gone",
  );

  // 3. What gone workers left behind.
  const dead = spawnSync(process.execPath, ["-e", ""]).pid;
  const abandoned = path.join(
    store,
    `${"b".repeat(32)}-${"c".repeat(32)}.lock`,
  );
  fs.mkdirSync(abandoned);
  fs.writeFileSync(path.join(abandoned, "owner"), `${dead}:gone`);
  const live = path.join(store, `${"d".repeat(32)}-${"e".repeat(32)}.lock`);
  fs.mkdirSync(live);
  fs.writeFileSync(path.join(live, "owner"), `${process.pid}:here`);
  // A partial write names its writer: `<publication>.<pid>.<uuid>.tmp`.
  const partial = (pid: number) =>
    path.join(
      store,
      `${"9".repeat(32)}-${"8".repeat(32)}.json.${pid}.${crypto.randomUUID()}.tmp`,
    );
  const deadWrite = partial(dead!);
  fs.writeFileSync(deadWrite, "{");
  // However long ago it began, a live writer's write is its own to finish.
  const liveWrite = partial(process.pid);
  fs.writeFileSync(liveWrite, "{");
  const long = new Date(Date.now() - 3_600_000);
  fs.utimesSync(liveWrite, long, long);
  await publish(others[0]!, "0".repeat(32));
  assert.equal(fs.existsSync(abandoned), false, "a dead worker's lock");
  assert.equal(
    fs.existsSync(deadWrite),
    false,
    "a dead writer's partial write",
  );
  assert.equal(fs.existsSync(live), true, "a live worker keeps its lock");
  assert.equal(fs.existsSync(liveWrite), true, "and its partial write");
}
