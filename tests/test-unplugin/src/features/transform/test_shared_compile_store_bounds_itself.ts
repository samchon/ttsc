import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { TtscSharedCompilePublication } from "../../../../../packages/unplugin/lib/core/transform/session/TtscSharedCompilePublication.mjs";
import { claimSharedCompile } from "../../../../../packages/unplugin/lib/core/transform/session/claimSharedCompile.mjs";

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
 * 3. Leave a lock owned by a dead process and a partial write older than any
 *    heartbeat, publish once more, and assert both are removed while a live
 *    worker's lock stays.
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
  const partial = path.join(store, "partial.json.1.tmp");
  fs.writeFileSync(partial, "{");
  const stale = new Date(Date.now() - 60_000);
  fs.utimesSync(partial, stale, stale);
  await publish(others[0]!, "0".repeat(32));
  assert.equal(fs.existsSync(abandoned), false, "a dead worker's lock");
  assert.equal(fs.existsSync(partial), false, "a dead writer's partial write");
  assert.equal(fs.existsSync(live), true, "a live worker keeps its lock");
}
