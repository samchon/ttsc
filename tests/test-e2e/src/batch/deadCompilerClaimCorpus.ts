import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { E2eProcessTrace } from "../../../utils/src/E2eProcessTrace";
import { waitFor } from "../internal/unplugin/internal/adapter-vite-serve/waitFor";
import { BatchWorkspace } from "./BatchWorkspace";

/**
 * Verifies an actual dead holder cannot strand a shared native capture claim.
 *
 * The upfront package-owned producer retains the original delayed transform.
 * Its existing invocation log optionally records actual native PIDs, allowing
 * this owner to join departed native work before releasing the shared graph.
 *
 * 1. Observe a real holder's lock token and first native invocation receipt.
 * 2. Kill only that owned Node holder and observe its actual close and native
 *    departure.
 * 3. Require a survivor's native result, second receipt and complete lock removal.
 *
 * @evidence contracts/testing.md#behavioral-verification Two actual public unplugin API workers share one claim identity/state. The holder dies after its PID-owned lock and native invocation; the survivor must return PROBED, acquire another native invocation and remove the residual lock.
 * @evidence contracts/testing.md#independent-expectations Literal PROBE/PROBED source, the actual lock owner PID and the producer's existing native receipt distinguish takeover and real output from deleting a lock or returning stale text. Native PIDs are actual invocation owners, not a Program count.
 * @evidence contracts/testing.md#distinguishing-cases An interrupted in-flight owner contrasts with its succeeding live worker. Existing former-holder units own timestamp takeover/fencing and pruning units own seeded dead-owner cleanup; neither replaces this processGone-to-native-publication connection.
 * @evidence contracts/testing.md#execution-ownership The selected Metro DAG collects this independent helper beside its existing resident loader pool. Two extra Node worker lifetimes and two actual native producer invocations are explicit costs; no per-case fixture or new production API is introduced.
 * @evidence contracts/e2e.md#necessary-boundary Actual cross-process lock ownership, death detection, native capture and survivor publication cannot be proved by in-process timestamp aging or record pruning alone.
 * @evidence contracts/e2e.md#shared-execution Both workers use one upfront immutable source project, one owning Go producer copy, one SDK availability cache and one private claim store. The failed holder and survivor must have separate lifetimes; neither installs or creates another source project. Native build/preparation totals remain unmeasured.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only the observed owned Node holder receives SIGKILL. Every acquired worker joins close and PID departure; recorded native PIDs must become ESRCH without being killed by this helper. Unknown closure/departure retains shared inputs. The claim store remains until BatchWorkspace closes after all consumers.
 * @evidence contracts/e2e.md#preserved-coverage Preserves the original actual-holder lock, native-start receipt, killed outcome, residual lock, survivor PROBED/second native receipt and empty-lock assertions. Native descendant departure is an explicit strengthening over the original unjoined descendant; single-digit independent execution remains uncertified.
 */
export async function deadCompilerClaimCorpus(
  workspace: BatchWorkspace.Workspace,
): Promise<void> {
  const root = path.join(workspace.root, "tools/native-dead-claim");
  const session = path.join(root, "claim-store");
  const log = path.join(root, "native-runs.log");
  assert.equal(fs.existsSync(session), false);
  assert.equal(fs.existsSync(log), false);
  fs.mkdirSync(session);
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
      },
    ],
  });
  const actors: {
    child: ReturnType<typeof E2eProcessTrace.spawn>;
    result?: {
      status: number | null;
      signal: NodeJS.Signals | null;
      stdout: string;
      stderr: string;
      error?: Error;
    };
  }[] = [];
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
  const departed = (pid: number) => {
    try {
      process.kill(pid, 0);
      return false;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") return true;
      throw error;
    }
  };
  const start = () => {
    const child = E2eProcessTrace.spawn(
      process.execPath,
      [
        path.join(root, "worker.mjs"),
        TestUnpluginRuntime.libUrl("api"),
        root,
        options,
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
    const actor: (typeof actors)[number] = { child };
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
    });
    child.once("close", (status, signal) => {
      actor.result = { status, signal, stdout, stderr, error };
    });
    return actor;
  };
  const failures: unknown[] = [];
  try {
    const holder = start();
    try {
      await waitFor(
        () => locks().length === 1 && nativePids().length === 1,
        "actual dead-claim holder lock and native invocation",
        120000,
      );
    } catch (error) {
      throw new Error("actual holder acquisition failed: " + JSON.stringify({
        holder: holder.result ?? "close not observed",
        locks: locks(),
        nativePids: nativePids(),
      }), { cause: error });
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
    const firstNative = nativePids()[0]!;
    assert.notEqual(
      firstNative,
      holder.child.pid,
      "the native receipt belongs to a separate native process",
    );
    assert.equal(
      departed(firstNative),
      false,
      "the recorded native owner must still be alive before interruption",
    );
    assert.equal(holder.child.kill("SIGKILL"), true);
    await waitFor(
      () => holder.result !== undefined,
      "actual killed holder close",
      120000,
    );
    assert.equal(holder.result!.error, undefined);
    assert.ok(
      holder.result!.signal !== null || holder.result!.status !== 0,
      JSON.stringify(holder.result),
    );
    await waitFor(
      () => departed(holder.child.pid!),
      "killed holder PID departure",
      120000,
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
    await waitFor(
      () => departed(firstNative),
      "interrupted holder native PID departure",
      120000,
    );
    const survivor = start();
    await waitFor(
      () => survivor.result !== undefined,
      "actual survivor capture and close",
      120000,
    );
    assert.equal(survivor.result!.error, undefined);
    assert.equal(survivor.result!.signal, null);
    assert.equal(survivor.result!.status, 0, survivor.result!.stderr);
    const reply = JSON.parse(survivor.result!.stdout.trim()) as {
      error?: string;
      code?: string;
    };
    assert.equal(reply.error, undefined, reply.error);
    assert.match(reply.code ?? "", /PROBED/);
    assert.equal(
      nativePids().length,
      2,
      "the survivor must actually invoke the native producer instead of only dropping the lock",
    );
    assert.deepEqual(
      locks(),
      [],
      "the successful successor releases its claim",
    );
  } catch (error) {
    failures.push(error);
  } finally {
    for (const actor of actors) {
      try {
        if (actor.result === undefined) actor.child.kill("SIGKILL");
        await waitFor(
          () => actor.result !== undefined,
          "owned claim worker close",
          120000,
        );
        assert.equal(actor.result!.error, undefined);
        assert.ok(actor.child.pid !== undefined);
        await waitFor(
          () => departed(actor.child.pid!),
          "owned claim worker PID departure",
          120000,
        );
      } catch (error) {
        failures.push(error);
        BatchWorkspace.retain(
          "dead-claim worker ownership remained unresolved",
        );
      }
    }
    try {
      const recorded = nativePids();
      assert.ok(
        recorded.length > 0,
        "native ownership receipt was not acquired; do not certify interrupted preparation cleanup",
      );
      for (const pid of recorded)
        await waitFor(
          () => departed(pid),
          "recorded claim native owner departure",
          120000,
        );
    } catch (error) {
      failures.push(error);
      BatchWorkspace.retain("dead-claim native ownership remained unresolved");
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "actual dead compiler claim takeover");
}
