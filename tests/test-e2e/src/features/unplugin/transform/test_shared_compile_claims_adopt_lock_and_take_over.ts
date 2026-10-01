import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { TtscSharedCompilePublication } from "../../../../../../packages/unplugin/lib/core/transform/session/TtscSharedCompilePublication.mjs";
import { claimSharedCompile } from "../../../../../../packages/unplugin/lib/core/transform/session/claimSharedCompile.mjs";

/**
 * Verifies how the workers of one pooled session decide between adopting a
 * compile, compiling it under the lock, and taking over an abandoned lock
 * (samchon/ttsc#1390).
 *
 * The store is only an optimization, so every decision must fail toward the
 * worker compiling for itself: an unusable publication is absent, a store that
 * cannot be used answers nothing, and a holder whose process died loses its
 * lock rather than blocking the pool. In the other direction, an adopter may
 * take a compile only for the same identity and only while every external input
 * still has the state its publisher recorded, and a holder must never release a
 * lock another worker has since taken over.
 *
 * 1. Claim an empty store, publish, and assert a waiting claim adopts the
 *    publication, that a claim refusing adoption compiles under the lock, and
 *    that a malformed publication is not adopted.
 * 2. Leave a lock owned by a dead process and assert the next claim takes it over,
 *    and that the displaced holder's release leaves the new owner's lock
 *    alone.
 * 3. Point a claim at a store that cannot be used and assert it answers nothing.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls claimSharedCompile on real store files and a dead child PID; checks publication adoption, refused/malformed adoption, dead-lock takeover, displaced release fencing, unusable-store fallback.
 * @evidence contracts/testing.md#independent-expectations Exclusive locks and valid matching publication state define adoption; authored payloads, an independently terminated child and the successor's actual owner token distinguish incorrect publication reuse or displaced-holder release.
 * @evidence contracts/testing.md#distinguishing-cases Owns empty/published/malformed/unusable stores, waiting adoption, dead owner, displaced token.
 * @evidence contracts/testing.md#execution-ownership E2E entry executes real Node child lifetime plus filesystem lock/store ownership through built claim APIs. The child creates a genuinely terminated PID; portable identity/mismatch decisions execute in test-unplugin source units.
 * @evidence contracts/e2e.md#necessary-boundary The OS liveness check must distinguish a terminated process from this live holder while retaining lock fencing. A fake liveness answer cannot prove that process connection. Configuration identity and external-input comparison execute separately as source units.
 * @evidence contracts/e2e.md#shared-execution One short-lived child supplies the dead PID and one store batches all lock/publication states. No native producer or host is built; separate claims are necessary for ownership transitions, while shared packages are prepared once.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Every claim uses an explicit identity/state in a unique store; malformed and unusable states have separate paths. Normal claims release locks/timers, the child is synchronous and exited, and TestProject removes the store at worker exit; assertion failures may leave timers until that exit.
 * @evidence contracts/e2e.md#preserved-coverage All prior lock, adoption and takeover assertions remain here. Seven configuration-identity and five external-input comparison assertions execute in test_shared_compile_identity_and_external_input_adoption through source APIs; its literal resolver inputs replace the two former E2E fixture files.
 */
export async function test_shared_compile_claims_adopt_lock_and_take_over(): Promise<void> {
  const store = TestProject.tmpdir("ttsc-unplugin-shared-claims-");
  const identity = "a".repeat(32);
  const state = "b".repeat(64);
  const lock = path.join(store, `${identity}-${state}.lock`);
  const publication: TtscSharedCompilePublication = {
    externalInputHashes: { [path.resolve("/outside/helper.ts")]: "hash" },
    externalInputRealpaths: {
      [path.resolve("/outside/helper.ts")]: path.resolve("/real/helper.ts"),
    },
    result: {
      type: "success",
      typescript: {},
    } as unknown as TtscSharedCompilePublication["result"],
    scratchDirectory: path.resolve("/scratch"),
  };

  const holder = await claimSharedCompile(store, identity, state, {
    adopt: true,
  });
  assert.equal(holder?.kind, "compile", "the first worker compiles");
  assert.equal(fs.existsSync(lock), true);
  const waiter = claimSharedCompile(store, identity, state, { adopt: true });
  if (holder?.kind !== "compile") return;
  await holder.publish(publication);
  holder.release();
  assert.deepEqual(
    await waiter,
    { kind: "adopt", publication },
    "a waiter adopts the holder's publication",
  );
  assert.equal(fs.existsSync(lock), false, "the holder released its lock");

  const replacing = await claimSharedCompile(store, identity, state, {
    adopt: false,
  });
  assert.equal(
    replacing?.kind,
    "compile",
    "a worker that found the publication wanting compiles under the lock",
  );
  if (replacing?.kind === "compile") replacing.release();

  const malformed = "c".repeat(64);
  fs.writeFileSync(
    path.join(store, `${identity}-${malformed}.json`),
    JSON.stringify({ ...publication, result: { type: "exception" } }),
  );
  const unusable = await claimSharedCompile(store, identity, malformed, {
    adopt: true,
  });
  assert.equal(unusable?.kind, "compile", "a failed envelope is never adopted");
  if (unusable?.kind === "compile") unusable.release();

  const dead = spawnSync(process.execPath, ["-e", ""]).pid;
  fs.mkdirSync(lock);
  fs.writeFileSync(path.join(lock, "owner"), `${dead}:gone`);
  const successor = await claimSharedCompile(store, identity, state, {
    adopt: false,
  });
  assert.equal(
    successor?.kind,
    "compile",
    "a lock whose holder died is taken over",
  );
  const successorToken = fs.readFileSync(path.join(lock, "owner"), "utf8");
  assert.match(successorToken, new RegExp(`^${process.pid}:`));
  const displaced = await claimSharedCompile(store, identity, "d".repeat(64), {
    adopt: false,
  });
  assert.equal(displaced?.kind, "compile");
  const displacedLock = path.join(store, `${identity}-${"d".repeat(64)}.lock`);
  fs.writeFileSync(path.join(displacedLock, "owner"), successorToken);
  if (displaced?.kind === "compile") displaced.release();
  assert.equal(
    fs.existsSync(displacedLock),
    true,
    "a holder never releases a lock another worker took over",
  );
  if (successor?.kind === "compile") {
    successor.release();
    successor.release();
  }
  assert.equal(fs.existsSync(lock), false);

  const file = path.join(store, "not-a-directory");
  fs.writeFileSync(file, "");
  assert.equal(
    await claimSharedCompile(file, identity, state, { adopt: true }),
    undefined,
    "a store that cannot be used leaves the worker to compile for itself",
  );
}
