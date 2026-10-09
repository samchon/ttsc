import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { E2eProcessTrace } from "../../../utils/src/E2eProcessTrace";
import { NativeProcessObserver } from "../../../utils/src/NativeProcessObserver";
import { waitFor } from "../../../utils/src/internal/waitFor";
import { BatchWorkspace } from "./BatchWorkspace";

/**
 * Verifies an interrupted real holder cannot strand a shared native claim.
 *
 * Each actual native invocation stays behind an authenticated fixture gate
 * until this owner acquires its original kernel lifetime. Numeric PID
 * occupancy cannot replace original retirement or authorize shared reuse.
 *
 * 1. Bind the holder's claim and first receipt to an acquired live original.
 * 2. Interrupt the owned Node holder, release its native gate and observe
 *    original retirement while preserving the residual claim token.
 * 3. Require real takeover, PROBED and two further native responsiveness
 *    epochs, then independently settle workers, natives and observer.
 * 4. Restore exact source bytes only after qualified borrower retirement;
 *    retain unknown lifetimes and collect release/close/restore errors.
 *
 * @evidence contracts/testing.md#behavioral-verification Two actual public API workers share one claim. Authenticated native receipts are enrolled through the existing observer before release; the killed holder leaves its token and the survivor must return PROBED and release the final lock.
 * @evidence contracts/testing.md#independent-expectations Literal PROBE/PROBED source, the original holder token, fresh nonce/token/PID receipts and retained kernel identities distinguish real takeover from deleting a lock or returning cached output. Current PID disappearance is not an oracle.
 * @evidence contracts/testing.md#distinguishing-cases The interrupted first invocation contrasts with both succeeding native transforms. Matching gate release permits completion; unknown release never starts a held-native wait. Adjacent fixture units own wrong/malformed/duplicate/nonregular and actual I/O refusal controls.
 * @evidence contracts/testing.md#execution-ownership Two Node workers and exactly three actual native transforms remain explicit costs. One observer session uses the process-wide validated preparation, building the test observer once only when not already prepared. Both survivor five-second workloads and responsiveness observations remain real.
 * @evidence contracts/e2e.md#necessary-boundary Actual claim takeover, native execution and original kernel retirement require the real process/fixture boundary; portable receipt units do not certify those lifetimes or returned compiler output.
 * @evidence contracts/e2e.md#shared-execution Both workers keep the same immutable project, producer, availability cache, claim identity and gate options. The observer preparation is memoized; this corpus owns a distinct session and does not borrow Runtime's already closed session. Native preparation totals remain measured by the owning run.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only owned Node children receive kill requests. Native retirement uses acquired originals; enrollment qualifies its still-live original Node holder, and pending observation ends on the actual owner error/close rather than clock age. Gates live outside the selected source graph. Failed release avoids a circular wait, independently closes known Node/observer owners and retains inputs so the ordinary outer group/job can retire remaining descendants. Observer close is not target retirement, and unknown closure forbids source restoration or shared reuse.
 * @evidence contracts/e2e.md#preserved-coverage Retains the holder lock/token, actual interruption, residual claim, survivor PROBED, three receipts and empty final lock. Both completed holds retain source mutation, unchanged TEMP/TMP/TMPDIR, the deliberate elapsed-at-least-five-second workload and separately reported initial/intertick/terminal gap measurements. Source restoration, gate cleanup and every independent failure retain their own outcomes; raw Linux native state before this correction remains unproved.
 */
export async function deadCompilerClaimCorpus(
  workspace: BatchWorkspace.Workspace,
): Promise<void> {
  const root = path.join(workspace.root, "tools/native-dead-claim");
  const session = path.join(root, "claim-store");
  const log = path.join(root, "native-runs.log");
  const source = path.join(root, "src/mod.ts");
  const original = fs.readFileSync(source);
  const nonce = crypto.randomUUID();
  const gates = path.join(workspace.cache, "dead-claim-lifetimes-" + nonce);
  assert.equal(fs.existsSync(session), false);
  assert.equal(fs.existsSync(log), false);
  fs.mkdirSync(session);
  fs.mkdirSync(gates);
  const options = JSON.stringify({
    project: path.join(root, "tsconfig.json"),
    plugins: [
      {
        transform: path.join(root, "plugin.cjs"),
        name: "cache-probe",
        fixtureProtocol: "cache",
        runLog: log,
        runLogPids: true,
        transformDelayMs: 5000,
        nativeLifetimeDirectory: gates,
        nativeLifetimeSession: nonce,
      },
    ],
  });
  const actors: {
    child: ReturnType<typeof E2eProcessTrace.spawn>;
    closed: Promise<void>;
    error?: Error;
    result?: {
      status: number | null;
      signal: NodeJS.Signals | null;
      stdout: string;
      stderr: string;
      error?: Error;
    };
  }[] = [];
  type Observer = Awaited<
    ReturnType<ReturnType<typeof NativeProcessObserver.prepare>["open"]>
  >;
  type Receipt = { session: string; token: string; pid: number };
  const natives: {
    receipt: Receipt;
    bytes: Buffer;
    target?: Awaited<ReturnType<Observer["acquire"]>>;
    releaseAttempted: boolean;
    released: boolean;
    retirementAttempted: boolean;
    retired: boolean;
  }[] = [];
  let observer: Observer | undefined;
  const nativePids = () => {
    if (!fs.existsSync(log)) return [];
    const text = fs.readFileSync(log, "utf8");
    if (!text.endsWith("\n")) return [];
    return text
      .trim()
      .split(/\r?\n/)
      .map((line) => {
        assert.match(line, /^[1-9]\d*$/);
        const pid = Number(line);
        assert.ok(Number.isSafeInteger(pid));
        return pid;
      });
  };
  const locks = () =>
    fs.readdirSync(session).filter((name) => name.endsWith(".lock"));
  const start = (mode = "holder") => {
    const child = E2eProcessTrace.spawn(
      process.execPath,
      [
        path.join(root, "worker.mjs"),
        TestUnpluginRuntime.libUrl("api"),
        root,
        options,
        mode,
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          TTSC_CACHE_DIR: workspace.cache,
          TTSC_UNPLUGIN_TRANSFORM_SESSION: session,
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    let joined!: () => void;
    const closed = new Promise<void>((resolve) => { joined = resolve; });
    const actor: (typeof actors)[number] = { child, closed };
    actors.push(actor);
    let stdout = "",
      stderr = "",
      error: Error | undefined;
    child.stdout!.on("data", (data) => {
      stdout += data;
    });
    child.stderr!.on("data", (data) => {
      stderr += data;
    });
    child.once("error", (caught) => {
      error = caught;
      actor.error = caught;
    });
    child.once("close", (status, signal) => {
      actor.result = { status, signal, stdout, stderr, error };
      joined();
    });
    return actor;
  };
  const enroll = async (actor: (typeof actors)[number]) => {
    let native: (typeof natives)[number] | undefined;
    await waitFor(
      () => {
        if (actor.error) throw actor.error;
        assert.equal(actor.result, undefined, "worker closed before native enrollment");
        const candidates = fs.readdirSync(gates).filter(
          (name) =>
            name.endsWith(".json") &&
            !natives.some(({ receipt }) => name === receipt.token + ".json"),
        );
        assert.ok(candidates.length <= 1, "ambiguous native lifetime receipts");
        if (candidates.length) {
          const file = path.join(gates, candidates[0]!);
          assert.ok(fs.lstatSync(file).isFile(), "nonregular native receipt");
          const bytes = fs.readFileSync(file);
          if (!bytes.length || bytes.at(-1) !== 10) return false;
          const value: unknown = JSON.parse(bytes.toString("utf8"));
          assert.ok(value !== null && typeof value === "object");
          assert.deepEqual(Object.keys(value).sort(), ["pid", "session", "token"]);
          assert.ok("session" in value && value.session === nonce);
          assert.ok("token" in value && typeof value.token === "string");
          assert.match(value.token, /^[0-9a-f]{32}$/);
          assert.equal(candidates[0], value.token + ".json");
          assert.ok("pid" in value && typeof value.pid === "number");
          assert.ok(Number.isSafeInteger(value.pid) && value.pid > 0);
          const recorded = nativePids();
          assert.equal(recorded.length, natives.length + 1);
          assert.equal(recorded.at(-1), value.pid);
          assert.notEqual(value.pid, actor.child.pid);
          native = {
            receipt: { session: nonce, token: value.token, pid: value.pid },
            bytes,
            releaseAttempted: false,
            released: false,
            retirementAttempted: false,
            retired: false,
          };
          natives.push(native);
          return true;
        }
        assert.equal(
          actor.result,
          undefined,
          "worker closed before native enrollment",
        );
        return false;
      },
      "authenticated held native invocation",
      { check: () => {
        if (actor.error) throw actor.error;
        assert.equal(actor.result, undefined, "worker closed before native enrollment");
      } },
    );
    assert.ok(native !== undefined && observer !== undefined);
    native.target = await observer.acquire(native.receipt.pid);
    assert.equal(await observer.retired(native.target), false);
    console.error("Dead claim original enrolled: " + JSON.stringify(native));
    return native;
  };
  const release = (native: (typeof natives)[number]) => {
    assert.equal(native.releaseAttempted, false);
    native.releaseAttempted = true;
    const file = path.join(gates, native.receipt.token + ".release");
    const bytes = Buffer.from(JSON.stringify(native.receipt) + "\n");
    fs.writeFileSync(file, bytes, { flag: "wx", mode: 0o600 });
    assert.ok(fs.lstatSync(file).isFile(), "nonregular native release");
    assert.deepEqual(fs.readFileSync(file), bytes);
    native.released = true;
  };
  const retire = async (native: (typeof natives)[number]) => {
    assert.ok(observer !== undefined && native.target !== undefined);
    assert.equal(
      native.released,
      true,
      "never await a native behind an unknown release",
    );
    assert.equal(native.retirementAttempted, false);
    native.retirementAttempted = true;
    await waitFor(
      async () => {
        native.retired = await observer!.retired(native.target!);
        return native.retired;
      },
      "original native lifetime retirement",
    );
  };
  const failures: unknown[] = [];
  try {
    observer = await NativeProcessObserver.prepare().open();
    const holder = start();
    try {
      await waitFor(
        () => {
          if (holder.error) throw holder.error;
          assert.equal(holder.result, undefined, "holder closed before live claim publication");
          return locks().length === 1 && nativePids().length === 1;
        },
        "actual dead-claim holder lock and native invocation",
        { check: () => {
          if (holder.error) throw holder.error;
          assert.equal(holder.result, undefined, "holder closed before claim publication");
        } },
      );
    } catch (error) {
      throw new Error(
        "actual holder acquisition failed: " +
          JSON.stringify({
            holder: holder.result ?? "close not observed",
            locks: locks(),
            nativePids: nativePids(),
          }),
        { cause: error },
      );
    }
    const lock = locks()[0]!;
    const token = fs.readFileSync(path.join(session, lock, "owner"), "utf8");
    assert.match(token, /^\d+:[0-9a-f-]+$/i);
    assert.equal(Number.parseInt(token, 10), holder.child.pid);
    assert.equal(
      Boolean(holder.result),
      false,
      "the holder must still be in flight",
    );
    const firstNative = await enroll(holder);
    assert.equal(holder.child.kill("SIGKILL"), true);
    await holder.closed;
    assert.equal(holder.result!.error, undefined);
    assert.ok(
      holder.result!.signal !== null || holder.result!.status !== 0,
      JSON.stringify(holder.result),
    );
    assert.deepEqual(
      locks(),
      [lock],
      "actual holder death must leave its claim unreleased",
    );
    assert.equal(
      fs.readFileSync(path.join(session, lock, "owner"), "utf8"),
      token,
    );
    release(firstNative);
    await retire(firstNative);
    const survivor = start("responsive");
    for (let invocation = 0; invocation < 2; invocation++) {
      const native = await enroll(survivor);
      release(native);
      await retire(native);
    }
    await survivor.closed;
    assert.equal(survivor.result!.error, undefined);
    assert.equal(survivor.result!.signal, null);
    assert.equal(survivor.result!.status, 0, survivor.result!.stderr);
    const reply = JSON.parse(survivor.result!.stdout.trim()) as {
      error?: string;
      code?: string;
      observations: {
        code: string | null;
        before: [string, string | null][];
        after: [string, string | null][];
        maximumGapMs: number;
        elapsedMs: number;
        nativeRuns: number;
      }[];
    };
    assert.equal(reply.error, undefined, reply.error);
    assert.match(reply.code ?? "", /PROBED/);
    assert.equal(
      nativePids().length,
      3,
      "the survivor must actually invoke the native producer instead of only dropping the lock",
    );
    assert.equal(reply.observations.length, 2);
    assert.deepEqual(
      reply.observations.map(({ nativeRuns }) => nativeRuns),
      [2, 3],
      "both completed survivor epochs must perform their own actual native hold",
    );
    for (const observation of reply.observations) {
      assert.match(observation.code ?? "", /PROBED/);
      assert.deepEqual(observation.after, observation.before);
      assert.ok(observation.elapsedMs >= 5000, JSON.stringify(observation));
      assert.ok(Number.isFinite(observation.maximumGapMs) && observation.maximumGapMs >= 0);
      console.info("native-claim survivor timing", JSON.stringify(observation));
    }
    assert.deepEqual(
      locks(),
      [],
      "the successful successor releases its claim",
    );
  } catch (error) {
    failures.push(error);
  } finally {
    // Release known gates independently. A failed release must not become an
    // indefinite native wait that prevents the enclosing owner from retiring.
    for (const native of natives)
      if (!native.releaseAttempted)
        try {
          release(native);
        } catch (error) {
          failures.push(error);
        }
    let workersJoined = true;
    for (const actor of actors) {
      try {
        if (actor.result === undefined) actor.child.kill("SIGKILL");
        await actor.closed;
        assert.equal(actor.result!.error, undefined);
      } catch (error) {
        workersJoined = false;
        failures.push(error);
      }
    }
    for (const native of natives)
      if (native.target && !native.retired && observer)
        try {
          if (native.released && !native.retirementAttempted) await retire(native);
          else native.retired = await observer.retired(native.target);
        } catch (error) {
          failures.push(error);
        }
    let nativesJoined = false;
    try {
      const recorded = nativePids();
      assert.ok(
        actors.length === 0 || recorded.length > 0,
        "native ownership was not acquired; do not certify interrupted preparation cleanup",
      );
      assert.equal(recorded.length, natives.length);
      assert.ok(natives.every((native) => native.target && native.retired));
      nativesJoined = true;
    } catch (error) {
      failures.push(error);
    }
    let observerJoined = observer === undefined;
    try {
      if (observer) await observer.close();
      observerJoined = true;
    } catch (error) {
      failures.push(error);
    }
    if (!workersJoined || !nativesJoined || !observerJoined) {
      try {
        BatchWorkspace.retain(
          "dead-claim original lifetime remained unresolved; retained gate directory: " + gates,
        );
      } catch (error) {
        failures.push(error);
      }
    } else {
      try {
        fs.writeFileSync(source, original);
        assert.deepEqual(fs.readFileSync(source), original);
      } catch (error) {
        failures.push(error);
        try {
          BatchWorkspace.retain("dead-claim source restoration failed");
        } catch (retentionError) {
          failures.push(retentionError);
        }
      }
      try {
        for (const name of fs.readdirSync(gates)) {
          assert.match(name, /^[0-9a-f]{32}\.(?:json|release)$/);
          assert.ok(fs.lstatSync(path.join(gates, name)).isFile());
          fs.unlinkSync(path.join(gates, name));
        }
        fs.rmdirSync(gates);
      } catch (error) {
        failures.push(error);
        try {
          BatchWorkspace.retain("dead-claim rendezvous cleanup failed");
        } catch (retentionError) {
          failures.push(retentionError);
        }
      }
    }
    console.error(
      "Dead claim lifetime settlement: " +
        JSON.stringify({ gates, workersJoined, nativesJoined, observerJoined, natives }),
    );
  }
  if (failures.length)
    throw new AggregateError(failures, "actual dead compiler claim takeover");
}
