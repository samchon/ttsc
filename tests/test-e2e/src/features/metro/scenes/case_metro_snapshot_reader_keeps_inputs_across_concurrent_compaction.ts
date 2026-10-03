import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
import { TestProject } from "../../../../../utils/src/TestProject";
import type * as Fingerprint from "../../../../../../packages/metro/src/core/fingerprint";

/**
 * Verifies trusted snapshot reads retain completed records during compaction.
 *
 * The caller supplies a fresh bare project and an empty external scratch slot
 * in the shared Metro workspace. Both processes load the same prepared emitted
 * fingerprint module; this body does not install or activate another consumer.
 *
 * 1. Admit one nonce-tagged child and run its original 150 rounds.
 * 2. Read completed progress BEFORE each snapshot; permit undefined fail-closed.
 * 3. Join the owned child and require all 150 inputs in a final trusted state.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual record/prepareSnapshot runs in a second Node process while the parent calls readSnapshotState; every trusted read must include all records completed before that read began.
 * @evidence contracts/testing.md#independent-expectations Literal150 and input-N.d.ts paths are authored independently; nonce admission, done150, exit0 and a final complete membership oracle prevent an empty initial snapshot from satisfying trusted>0 alone.
 * @evidence contracts/testing.md#distinguishing-cases Undefined race reads may fail closed; defined states cannot lose an already completed input. Final productive trust is required, and child error/nonzero/signal/deadline/cancellation fail separately.
 * @evidence contracts/testing.md#execution-ownership The consolidated Metro host enables this final scene in its existing shared workspace and supplies the actual built fingerprint module plus cold bare/external slots. Default legacy Metro selection remains unchanged. Registration is authored, actual selected execution remains unverified and the original test-metro donor remains.
 * @evidence contracts/e2e.md#necessary-boundary The native filesystem has two actual concurrent process views of worker publication and main compaction; injected read interleavings do not exercise this connection.
 * @evidence contracts/e2e.md#shared-execution Reuses the experiment's prepared emitted module and bare/external workspace slots. One actual compactor process is necessary for this concurrency distinction, without native compiler preparation or another installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Caller supplies cold snapshot and absent progress/nonce files. The child is killed only on owned failure/cancellation/deadline, and close is awaited before return or throw; no slot is deleted here or before that join. Arbitrary descendants are not certified by close.
 * @evidence contracts/e2e.md#preserved-coverage Original150/progress-before-read/undefined allowance/trusted>0/lost[]/exit0/done150 remain; readiness and final all150 strengthen their intended meaning. No direct policy unit or authored body is counted as executed survival.
 */
export async function case_metro_snapshot_reader_keeps_inputs_across_concurrent_compaction(
  root: string,
  scratch: string,
  moduleFile: string,
  signal?: AbortSignal,
): Promise<void> {
  assert.ok(path.isAbsolute(root) && path.isAbsolute(scratch) && path.isAbsolute(moduleFile));
  assert.equal(path.extname(moduleFile), ".mjs", "prepared emitted Metro module");
  const progress = path.join(scratch, "progress.txt");
  const ready = path.join(scratch, "ready.txt");
  const done = path.join(scratch, "done.txt");
  for (const file of [progress, ready, done]) assert.equal(fs.existsSync(file), false);
  assert.equal(signal?.aborted ?? false, false, "cancelled before admission");
  const fingerprint = await import(pathToFileURL(moduleFile).href) as typeof Fingerprint;
  fingerprint.prepareSnapshot(root);
  const nonce = randomUUID();
  const child = E2eProcessTrace.spawn(process.execPath, [
    path.join(TestProject.WORKSPACE_ROOT,
      "tests/test-e2e/fixtures/metro/concurrent-compaction/compactor.mjs"),
    root, scratch, moduleFile, nonce,
  ], { stdio: ["ignore", "inherit", "inherit"] });
  let closed = false;
  let exit: { code: number | null; signal: NodeJS.Signals | null } | undefined;
  const failures: unknown[] = [];
  child.on("error", error => failures.push(error));
  child.once("exit", (code, exitSignal) => { exit = { code, signal: exitSignal }; });
  const join = new Promise<void>(resolve => child.once("close", () => {
    closed = true;
    resolve();
  }));
  const stopOwnedChild = () => {
    if (closed) return;
    try { child.kill(); }
    catch (error) { failures.push(error); }
  };
  const cancel = () => {
    failures.push(new Error("compactor cancelled"));
    stopOwnedChild();
  };
  signal?.addEventListener("abort", cancel, { once: true });
  const deadline = setTimeout(() => {
    failures.push(new Error("compactor exceeded its 60s harness deadline"));
    stopOwnedChild();
  }, 60_000);
  let trusted = 0;
  const lost: number[] = [];
  const inputOf = (round: number) => path.resolve(scratch, `input-${round}.d.ts`);
  const completedRounds = () => {
    try {
      const text = fs.readFileSync(progress, "utf8");
      if (text === "done") return 150;
      // A read during publication may see an empty file. Never count malformed
      // data as completed work or silently accept a value beyond the corpus.
      if (text === "") return 0;
      assert.match(text, /^(?:[1-9][0-9]*)$/);
      const value = Number(text);
      assert.ok(Number.isSafeInteger(value) && value <= 150);
      return value;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
      throw error;
    }
  };
  try {
    if (signal?.aborted) cancel();
    while (!closed && failures.length === 0) {
      const completed = completedRounds();
      const state = fingerprint.readSnapshotState(root);
      if (state !== undefined) {
        ++trusted;
        for (let round = 0; round < completed; ++round)
          if (!state.files.includes(inputOf(round))) { lost.push(round); break; }
      }
      await new Promise<void>(resolve => setImmediate(resolve));
    }
  } catch (error) {
    failures.push(error);
  } finally {
    stopOwnedChild();
    await join;
    clearTimeout(deadline);
    signal?.removeEventListener("abort", cancel);
  }
  try {
    assert.deepEqual(exit, { code: 0, signal: null });
    assert.equal(fs.readFileSync(ready, "utf8"), nonce);
    assert.equal(fs.readFileSync(done, "utf8"), nonce);
    assert.equal(completedRounds(), 150);
    assert.ok(trusted > 0, "the reader must observe trusted states");
    assert.deepEqual(lost, [], "trusted reads retain every earlier completed input");
    const final = fingerprint.readSnapshotState(root);
    assert.ok(final !== undefined, "final productive state must be trusted");
    for (let round = 0; round < 150; ++round)
      assert.ok(final.files.includes(inputOf(round)), `final input ${round}`);
  } catch (error) {
    failures.push(error);
  }
  if (failures.length) throw new AggregateError(failures, "Metro concurrent compaction");
}
