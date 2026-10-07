import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { claimSharedCompile } from "../../../../../packages/unplugin/src/core/transform/session/claimSharedCompile";
import type { TtscSharedCompilePublication } from "../../../../../packages/unplugin/src/core/transform/session/TtscSharedCompilePublication";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies that refutation excludes a payload rather than every publication of its state.
 *
 * 1. Read a real persisted healthy payload and refuse its exact bytes.
 * 2. A waiting claimant adopts a peer's failure replacement under the same state.
 * 3. Identical bytes remain excluded; other callers and state keys remain independent.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual store claims, lock ownership, JSON publication and release distinguish a refuted payload from its same-state replacement. A waiter begun while the peer holds the lock must adopt the replacement rather than compile again. Identical republishing retains the refutation digest; malformed bytes never authorize adoption.
 * @evidence contracts/testing.md#independent-expectations Literal payload fields and independently SHA-256-hashed persisted bytes prescribe fingerprints and selected values. Authored healthy/failure external hashes share one state key deliberately; no compiler or input proof is simulated by the store assertions.
 * @evidence contracts/testing.md#distinguishing-cases Same state with changed payload versus identical bytes, caller with versus without refutation, distinct state, explicit adopt false, malformed JSON and peer-held replacement retain distinct outcomes.
 * @evidence contracts/testing.md#execution-ownership One direct unit owns actual filesystem claims and publications in a temporary store, without installation, child or native compiler. Existing capture/adoption tests own input proof and movement caps; full Metro owns actual two-worker failure/replay/repair.
 */
export async function test_shared_compile_refutation_excludes_only_the_read_payload(): Promise<void> {
  const store = TestProject.tmpdir("ttsc-refuted-publication-");
  const identity = "a".repeat(32);
  const state = "b".repeat(32);
  const otherState = "c".repeat(32);
  const file = path.join(store, `${identity}-${state}.json`);
  const healthy: TtscSharedCompilePublication = {
    externalInputHashes: { [path.join(store, "external.d.ts")]: "before" },
    externalInputRealpaths: { [path.join(store, "external.d.ts")]: path.join(store, "external.d.ts") },
    result: { type: "success", typescript: {} },
    scratchDirectory: path.join(store, "healthy-scratch"),
  };
  const failed: TtscSharedCompilePublication = {
    ...healthy,
    externalInputHashes: { [path.join(store, "external.d.ts")]: "after" },
    result: { type: "failure", typescript: {}, diagnostics: [{ file: path.join(store, "external.d.ts"), category: "error", code: 9999, messageText: "authored failure" }] },
    scratchDirectory: path.join(store, "failed-scratch"),
  };
  const original = await claimSharedCompile(store, identity, state, { adopt: true });
  assert.ok(original?.kind === "compile");
  try { await original.publish(healthy); } finally { original.release(); }
  const read = await claimSharedCompile(store, identity, state, { adopt: true });
  assert.ok(read?.kind === "adopt");
  assert.deepEqual(read.publication, healthy);
  assert.equal(read.fingerprint, createHash("sha256").update(fs.readFileSync(file)).digest("hex"));
  const replacement = await claimSharedCompile(store, identity, state, { adopt: true, rejectedPublication: read.fingerprint });
  assert.ok(replacement?.kind === "compile", "unchanged refuted bytes cannot be adopted");
  const waiting = claimSharedCompile(store, identity, state, { adopt: true, rejectedPublication: read.fingerprint });
  let adopted: Awaited<typeof waiting>;
  try { await replacement.publish(failed); } finally { replacement.release(); }
  adopted = await waiting;
  assert.ok(adopted?.kind === "adopt", "peer replacement remains eligible while the state key is unchanged");
  assert.deepEqual(adopted.publication, failed);
  assert.notEqual(adopted.fingerprint, read.fingerprint);
  assert.equal(adopted.fingerprint, createHash("sha256").update(fs.readFileSync(file)).digest("hex"));
  const independent = await claimSharedCompile(store, identity, state, { adopt: true });
  assert.ok(independent?.kind === "adopt");
  assert.equal(independent.fingerprint, adopted.fingerprint, "refutation is caller-local");
  const identical = await claimSharedCompile(store, identity, state, { adopt: true, rejectedPublication: adopted.fingerprint });
  assert.ok(identical?.kind === "compile");
  try { await identical.publish(failed); } finally { identical.release(); }
  const sameBytes = await claimSharedCompile(store, identity, state, { adopt: true, rejectedPublication: adopted.fingerprint });
  assert.ok(sameBytes?.kind === "compile", "republishing identical bytes cannot reset refutation");
  sameBytes.release();
  const separate = await claimSharedCompile(store, identity, otherState, { adopt: true, rejectedPublication: read.fingerprint });
  assert.ok(separate?.kind === "compile");
  try { await separate.publish(failed); } finally { separate.release(); }
  const separateRead = await claimSharedCompile(store, identity, otherState, { adopt: true, rejectedPublication: read.fingerprint });
  assert.ok(separateRead?.kind === "adopt");
  assert.deepEqual(separateRead.publication, failed);
  const forced = await claimSharedCompile(store, identity, state, { adopt: false });
  assert.ok(forced?.kind === "compile");
  forced.release();
  fs.writeFileSync(file, "{malformed");
  const malformed = await claimSharedCompile(store, identity, state, { adopt: true });
  assert.ok(malformed?.kind === "compile");
  malformed.release();
}