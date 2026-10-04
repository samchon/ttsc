import assert from "node:assert/strict";

import { ResidentTransformProcess } from "../../../../../../packages/ttsc/lib/compiler/internal/ResidentTransformProcess.js";
import { observeResidentTransformClose } from "../../../internal/ttsc/internal/observeResidentTransformClose";

/**
 * One controlled peer supplies legal negatives, operation mismatches and FIFO
 * echoes before its final malformed frame and valid tail. These are transport
 * inputs, not a Go transformation oracle.
 */
const ECHO_STUB = `
process.stdin.setEncoding("utf8");
let buf = "";
let corrupted = false;
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf("\\n")) !== -1) {
    const line = buf.slice(0, i);
    buf = buf.slice(i + 1);
    if (line.trim().length === 0) continue;
    const req = JSON.parse(line);
    if (corrupted) continue;
    if (req.file === "corrupt.ts") {
      corrupted = true;
      process.stdout.write("not-json\\n");
      process.stdout.write(JSON.stringify({ typescript: "echo:corrupt.ts", found: true }) + "\\n");
      continue;
    }
    if (req.update !== undefined) {
      process.stdout.write(JSON.stringify(req.update === "wrong-update.ts"
        ? { found: true, typescript: "x" } : { updated: false }) + "\\n");
      continue;
    }
    if (req.file === "wrong-transform.ts" || req.file === "missing-text.ts" || req.file === "missing.ts") {
      const reply = req.file === "wrong-transform.ts" ? { updated: true }
        : req.file === "missing-text.ts" ? { found: true }
        : { typescript: "", found: false };
      process.stdout.write(JSON.stringify(reply) + "\\n");
      continue;
    }
    process.stdout.write(
      JSON.stringify({ typescript: "echo:" + req.file, found: true }) + "\\n",
    );
  }
});
`;

/** A stub that exits on the first request without replying (host dies). */
const DIE_STUB = `
process.stdin.resume();
process.stdin.once("data", () => process.exit(7));
`;

function spawnStub(stub: string): ResidentTransformProcess {
  return new ResidentTransformProcess({
    binary: process.execPath,
    args: ["-e", stub],
  });
}

/**
 * Verifies the resident protocol client's lifecycle against a stub host: FIFO
 * matching of concurrent replies, dispose rejecting later requests, and a host
 * that dies mid-session rejecting the in-flight request without crashing the
 * consumer (the stream "error" handlers added for samchon/ttsc#255).
 *
 * This is the direct regression test for the pipe-error hardening: reaching the
 * end of the host-death case is itself the no-crash assertion, because an
 * unhandled pipe "error" would take the whole test process down.
 *
 * 1. Preserve negatives and recover from three operation mismatches, then
 *    resolve concurrent FIFO echoes before terminal corruption on that peer.
 * 2. Warm another peer, dispose it and reject a subsequent request.
 * 3. Exit a third peer during a request and require rejection without crashing.
 *
 * @evidence contracts/testing.md#behavioral-verification One actual pipe session resolves transform/update negatives, rejects three operation-specific shapes, remains usable, delivers concurrent a.ts/b.ts identities and rejects both queued owners plus later requests after not-json followed by a valid tail. Separate disposal and exit7 sessions retain lifecycle observations.
 * @evidence contracts/testing.md#independent-expectations The independent echo fixture returns the received filename and the exit fixture sends no reply; authored names establish reply ownership without querying client queue logic.
 * @evidence contracts/testing.md#distinguishing-cases Legal negatives differ from update-shaped transform, found-without-text and transform-shaped update replies. Wrong shape consumes one slot and permits recovery; malformed framing retires every slot and ignores a valid tail. Actual disposal and abrupt death remain separate terminal states, with cancellation owned by request_bounds. The six malformed/nonobject parser literals execute in test_resident_transform_reply_preserves_frame_and_operation_admission.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this named API feature; ResidentTransformProcess starts real Node children and exchanges stdin/stdout protocol lines.
 * @evidence contracts/e2e.md#necessary-boundary Real pipes can close or emit unhandled errors independently of promise/JSON logic; the abrupt-host case protects consumer survival, while the echo fixture supplies a controlled peer rather than a real Go transform oracle.
 * @evidence contracts/e2e.md#shared-execution One existing echo lifetime handles negative, shape, FIFO and malformed-tail observations in that order. Corruption is last because retirement prohibits later healthy requests. A second handles explicit dispose-after-warmup and a third intentionally dies; neither terminal state can replace the other. No extra child, native build or installation is added for the four retired policy entries.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Every distinct client subscribes to its actual owned child's close before requests, then disposes and awaits that receipt in finally. The private child read is cleanup-only, not an oracle or method replacement. Close timeout remains failure, not a joined descendant tree; all independent scenario and cleanup causes are retained.
 * @evidence contracts/e2e.md#preserved-coverage Original negatives, three shape errors and legal recovery, queued malformed rejection with valid tail, later rejection, FIFO identities, warm disposal and host-death rejection retain actual connection owners here. Production-used parser and FIFO slot units own all six raw-frame distinctions, first-error identity and terminal tail logic directly. Settlement observers precede concurrent assertions and independent check failures are collected before terminal corruption. All three lifetimes are attempted; actual fixture close does not certify a Go producer or final experiment-budget closure. Authored/unexecuted.
 */
export const test_residenttransformprocess_lifecycle = async () => {
  const failures: unknown[] = [];
  // 1. FIFO: two concurrent requests each resolve to their own ordered reply.
  {
    let proc: ResidentTransformProcess | undefined;
    let release: (() => Promise<void>) | undefined;
    try {
      proc = spawnStub(ECHO_STUB);
      release = observeResidentTransformClose(proc);
      const client = proc;
      const check = async (name: string, operation: () => Promise<void>): Promise<void> => {
        try { await operation(); }
        catch (cause) { failures.push(new Error(name, { cause })); }
      };
      await check("Legal transform negative", async () => {
        const reply = await client.request({ file: "missing.ts" }, "transform");
        assert.equal(reply.found, false);
      });
      await check("Legal update negative", async () => {
        const reply = await client.request({ update: "missing.ts", content: "x" }, "update");
        assert.equal(reply.updated, false);
      });
      await check("Update shape cannot answer transform", async () => {
        await assert.rejects(() => client.request({ file: "wrong-transform.ts" }, "transform"), /invalid transform reply/);
      });
      await check("Found transform requires text", async () => {
        await assert.rejects(() => client.request({ file: "missing-text.ts" }, "transform"), /invalid transform reply/);
      });
      await check("Transform shape cannot answer update", async () => {
        await assert.rejects(() => client.request({ update: "wrong-update.ts", content: "x" }, "update"), /invalid update reply/);
      });
      await check("Session survives operation mismatches", async () => {
        const reply = await client.request({ file: "missing.ts" }, "transform");
        assert.equal(reply.found, false);
      });
      await check("FIFO echo identities", async () => {
      const replies = await Promise.allSettled([
        client.request({ file: "a.ts" }, "transform"),
        client.request({ file: "b.ts" }, "transform"),
      ]);
      const first = replies[0]!;
      const second = replies[1]!;
      if (first.status !== "fulfilled" || second.status !== "fulfilled") {
        const rejected: unknown[] = [];
        if (first.status === "rejected") rejected.push(first.reason);
        if (second.status === "rejected") rejected.push(second.reason);
        throw new AggregateError(rejected, "FIFO echo requests rejected");
      }
      const a = first.value;
      const b = second.value;
      assert.equal(a.found, true);
      assert.equal(a.typescript, "echo:a.ts");
      assert.equal(b.typescript, "echo:b.ts");
      });
      // This terminal corruption follows all healthy observations. It shares
      // their actual pipe owner rather than launching another malformed peer.
      const corrupt = proc.request({ file: "corrupt.ts" }, "transform");
      const collateral = proc.request({ file: "tail.ts" }, "transform");
      await Promise.allSettled([corrupt, collateral]);
      await check("Malformed head rejects its owner", async () => {
        await assert.rejects(corrupt, /malformed reply/);
      });
      await check("Valid tail cannot answer collateral slot", async () => {
        await assert.rejects(collateral, /malformed reply/);
      });
      await check("Malformed session rejects later requests", async () => {
        await assert.rejects(() => client.request({ file: "later.ts" }, "transform"), /malformed reply/);
      });
    } catch (error) {
      failures.push(new Error("FIFO echo", { cause: error }));
    } finally {
      try {
        if (release) await release();
        else proc?.dispose();
      } catch (error) {
        failures.push(new Error("FIFO echo cleanup", { cause: error }));
      }
    }
  }

  // 2. dispose() rejects any later request.
  {
    let proc: ResidentTransformProcess | undefined;
    let release: (() => Promise<void>) | undefined;
    try {
      proc = spawnStub(ECHO_STUB);
      release = observeResidentTransformClose(proc);
      const client = proc;
      const warm = await proc.request({ file: "warm.ts" }, "transform");
      assert.equal(warm.typescript, "echo:warm.ts");
      proc.dispose();
      await assert.rejects(() => client.request({ file: "after.ts" }, "transform"));
    } catch (error) {
      failures.push(new Error("Dispose after warmup", { cause: error }));
    } finally {
      try {
        if (release) await release();
        else proc?.dispose();
      } catch (error) {
        failures.push(new Error("Dispose after warmup cleanup", { cause: error }));
      }
    }
  }

  // 3. A host that dies mid-session rejects the in-flight request and does not
  //    crash the consumer; the stream "error" handlers swallow the broken pipe.
  {
    let proc: ResidentTransformProcess | undefined;
    let release: (() => Promise<void>) | undefined;
    try {
      proc = spawnStub(DIE_STUB);
      release = observeResidentTransformClose(proc);
      const client = proc;
      await assert.rejects(() => client.request({ file: "x.ts" }, "transform"));
    } catch (error) {
      failures.push(new Error("Abrupt host death", { cause: error }));
    } finally {
      try {
        if (release) await release();
        else proc?.dispose();
      } catch (error) {
        failures.push(new Error("Abrupt host death cleanup", { cause: error }));
      }
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "Resident transform lifecycle failures");
};
