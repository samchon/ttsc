import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { TtscSharedCompilePublication } from "../../../../../packages/unplugin/lib/core/transform/session/TtscSharedCompilePublication.mjs";
import { claimSharedCompile } from "../../../../../packages/unplugin/lib/core/transform/session/claimSharedCompile.mjs";

/**
 * Verifies a holder whose lock was taken over neither publishes over its
 * successor nor disturbs the successor's lock, and that two workers reclaiming
 * one abandoned lock end with one holder.
 *
 * A lock whose heartbeat went stale is taken over, but the former holder may
 * still be alive, finishing a slow compile. It published without checking it
 * still owned the lock, so its older answer replaced the successor's, and its
 * heartbeat kept touching the successor's lock. Two reclaimers removed the lock
 * by path, so the second removed the first's fresh lock (samchon/ttsc#1515).
 *
 * 1. Claim A, age its lock past the takeover bound, and claim B, which takes
 *    it over.
 * 2. Publish B, then A, and release A.
 * 3. Assert B's publication and B's lock remain.
 * 4. Age a lock again and let two claims race to reclaim it: one holds the
 *    lock, the other waits for it, and takes it only once it is released.
 */
export async function test_shared_compile_former_holder_neither_publishes_nor_touches_its_successor(): Promise<void> {
  const store = TestProject.tmpdir("ttsc-unplugin-shared-fence-");
  const identity = "a".repeat(32);
  const state = "b".repeat(64);
  const lock = path.join(store, `${identity}-${state}.lock`);
  const publicationFile = path.join(store, `${identity}-${state}.json`);
  const publication = (scratch: string): TtscSharedCompilePublication => ({
    externalInputHashes: {},
    externalInputRealpaths: {},
    result: {
      type: "success",
      typescript: {},
    } as unknown as TtscSharedCompilePublication["result"],
    scratchDirectory: path.resolve(scratch),
  });
  const age = (): void => {
    const past = new Date(Date.now() - 60_000);
    fs.utimesSync(lock, past, past);
  };

  const former = await claimSharedCompile(store, identity, state, {
    adopt: false,
  });
  assert.equal(former?.kind, "compile");
  age();
  const successor = await claimSharedCompile(store, identity, state, {
    adopt: false,
  });
  assert.equal(successor?.kind, "compile", "a stale lock is taken over");
  if (former?.kind !== "compile" || successor?.kind !== "compile") return;
  const successorToken = fs.readFileSync(path.join(lock, "owner"), "utf8");

  await successor.publish(publication("/successor"));
  await former.publish(publication("/former"));
  former.release();
  assert.equal(
    JSON.parse(fs.readFileSync(publicationFile, "utf8")).scratchDirectory,
    path.resolve("/successor"),
    "the former holder does not replace its successor's publication",
  );
  assert.equal(
    fs.readFileSync(path.join(lock, "owner"), "utf8"),
    successorToken,
    "the former holder leaves its successor's lock alone",
  );
  successor.release();

  const stale = await claimSharedCompile(store, identity, state, {
    adopt: false,
  });
  assert.equal(stale?.kind, "compile");
  age();
  const settled: string[] = [];
  const first = claimSharedCompile(store, identity, state, {
    adopt: false,
  }).then((claim) => (settled.push("first"), claim));
  const second = claimSharedCompile(store, identity, state, {
    adopt: false,
  }).then((claim) => (settled.push("second"), claim));
  const deadline = Date.now() + 5_000;
  while (settled.length === 0) {
    assert.ok(Date.now() < deadline, "one reclaimer takes the lock");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(settled.length, 1, "the other reclaimer waits for the holder");
  const winner = await (settled[0] === "first" ? first : second);
  assert.equal(winner?.kind, "compile");
  const winnerToken = fs.readFileSync(path.join(lock, "owner"), "utf8");
  if (winner?.kind === "compile") winner.release();
  const loser = await (settled[0] === "first" ? second : first);
  assert.equal(loser?.kind, "compile", "it takes the lock once released");
  assert.notEqual(
    fs.readFileSync(path.join(lock, "owner"), "utf8"),
    winnerToken,
  );
  if (loser?.kind === "compile") loser.release();
  if (stale?.kind === "compile") stale.release();
  assert.equal(fs.existsSync(lock), false);
}
