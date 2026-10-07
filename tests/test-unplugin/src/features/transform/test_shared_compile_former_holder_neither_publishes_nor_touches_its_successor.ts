import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { TtscSharedCompilePublication } from "../../../../../packages/unplugin/src/core/transform/session/TtscSharedCompilePublication";
import { claimSharedCompile } from "../../../../../packages/unplugin/src/core/transform/session/claimSharedCompile";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a holder whose lock was taken over neither publishes over its
 * successor nor removes the successor's lock on release, and that two workers
 * reclaiming one abandoned lock end with one holder.
 *
 * A lock whose heartbeat went stale is taken over, but the former holder may
 * still be alive, finishing a slow compile. It published without checking it
 * still owned the lock, so its older answer replaced the successor's, and its
 * heartbeat kept touching the successor's lock. Two reclaimers removed the lock
 * by path, so the second removed the first's fresh lock (samchon/ttsc#1515).
 *
 * 1. Claim A, age its lock past the takeover bound, and claim B, which takes it
 *    over.
 * 2. Publish B, then A, and release A.
 * 3. Assert B's publication and B's lock remain.
 * 4. Age a lock again and let two claims race to reclaim it: one holds the lock,
 *    the other waits for it, and takes it only once it is released.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls claimSharedCompile directly; ages real lock directories, publishes successor then former-holder payloads, and asserts only the successor publication/token survive, with one winner among two reclaimers and final removal.
 * @evidence contracts/testing.md#independent-expectations Exclusive ownership requires a displaced token to authorize neither publication nor release. Literal successor scratch path and unequal owner tokens establish fencing independently of takeover computation.
 * @evidence contracts/testing.md#distinguishing-cases Owns stale takeover, late publication/release, two simultaneous reclaimers and subsequent acquisition after release. Every acquired holder is released even if an assertion fails, including pending reclaimers. Heartbeat modification times are not measured. No native host or cross-process contention is exercised.
 * @evidence contracts/testing.md#execution-ownership Unit test: calls the real claimSharedCompile against a temporary store directory in one process, ageing the lock with utimes and awaiting the claims; publications are handwritten payloads. No compile, native host or second process runs.
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

  type Claim = Awaited<ReturnType<typeof claimSharedCompile>>;
  const holders = new Set<Extract<NonNullable<Claim>, { kind: "compile" }>>();
  const pending: Promise<Claim>[] = [];
  let closing = false;
  const acquire = (): Promise<Claim> => {
    const promise = claimSharedCompile(store, identity, state, {
      adopt: false,
    }).then((claim) => {
      if (claim?.kind === "compile") {
        holders.add(claim);
        if (closing) claim.release();
      }
      return claim;
    });
    pending.push(promise);
    return promise;
  };
  try {
    const former = await acquire();
    assert.equal(former?.kind, "compile");
    age();
    const successor = await acquire();
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

    const stale = await acquire();
    assert.equal(stale?.kind, "compile");
    age();
    const settled: string[] = [];
    const first = acquire().then((claim) => (settled.push("first"), claim));
    const second = acquire().then((claim) => (settled.push("second"), claim));
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
  } finally {
    closing = true;
    for (const holder of holders) holder.release();
    await Promise.allSettled(pending);
    for (const holder of holders) holder.release();
  }
}
