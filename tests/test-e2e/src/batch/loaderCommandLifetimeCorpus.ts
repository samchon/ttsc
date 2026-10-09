import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createLoaderPoolWorker } from "./LoaderPoolWorker";
import { OwnedE2eEntry } from "./OwnedE2eEntry";

/**
 * Verifies resident settlement and the ordinary entry's real process owner.
 *
 * Builtin-only peers hold requests until an explicit protocol release. Terminal
 * faults must permanently refuse later admission without inventing a deadline
 * or certifying closure from a rejected request.
 *
 * 1. Exchange held, out-of-order, domain-error and split UTF-8 replies.
 * 2. Collect readiness, framing, spawn, exit and cancellation failures.
 * 3. Contrast inherited and explicit Node flags, then join success, failure and descendant cancellation.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual resident helper communicates with static real Node peers; assertions distinguish retained pending work, matching IDs, terminal refusal, actual joined diagnostics and idempotent close. The actual ordinary carrier runs a static target and cancels its live descendant.
 * @evidence contracts/testing.md#independent-expectations Literal peer values, explicit held-ID barriers, authored UTF-8/stderr bytes, actual parent Node flags versus an authored explicit vector, target argv/context and native retirement classification supply independent expectations.
 * @evidence contracts/testing.md#distinguishing-cases Healthy and domain-error replies preserve admission; malformed/unknown/partial replies, duplicate/error readiness, failed spawn, nonzero/normal terminal close, pre-abort and pending cancellation distinguish terminal ownership. A same-cwd inherited carrier and different-cwd explicitly configured carriers preserve their actual option authority. Synchronous write throws and standalone pipe-error paths are reviewed safeguards, not empirically claimed controls.
 * @evidence contracts/testing.md#execution-ownership This corpus is selected by the ordinary Metro experiment and uses real Node pipes plus the already-built native supervisor. No compiler, Go producer, installer, monkeypatch or private-suite unit import is used.
 * @evidence contracts/e2e.md#necessary-boundary Real stream framing, spawn failure, original close and native descendant containment require actual process connections.
 * @evidence contracts/e2e.md#shared-execution Healthy concurrent and plugin-lock requests share one peer. Terminal alternatives need independent peer lifetimes; builtin-only carrier controls reuse the existing supervisor and do not prepare the shared compiler workspace.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Every peer owns a copied static root and original close. Different-cwd builtin targets own explicit Node flags without rewriting inherited options. Failed or unknown lifetimes retain the exact trace allocation; a retention refusal joins the original error aggregate, and the encompassing ordinary entry owns cancellation of its complete tree.
 * @evidence contracts/e2e.md#preserved-coverage These transport assertions precede existing native Metro cases, whose preparation and actual publication controls remain independently collected.
 */
export async function loaderCommandLifetimeCorpus(): Promise<void> {
  const trace = TestProject.tmpdir("ttsc-loader-lifetime-", process.env.TTSC_E2E_TRACE);
  const fixture = path.resolve(import.meta.dirname, "../../fixtures/metro/loader-command-lifetime");
  const failures: unknown[] = [];
  const collect = async (name: string, operation: () => Promise<void>) => {
    try {
      await operation();
      console.log("Loader lifetime control", name, "PASS");
    } catch (cause) {
      console.log("Loader lifetime control", name, "FAIL");
      failures.push(new Error(name, { cause }));
    }
  };
  let sequence = 0;
  const peer = async (
    name: string,
    startup: string,
    operation: (worker: ReturnType<typeof createLoaderPoolWorker>, root: string) => Promise<void>,
    signal?: AbortSignal,
  ) => collect(name, async () => {
    const root = path.join(trace, `${++sequence}-${name}`);
    TestProject.copyDirectory(fixture, root);
    fs.copyFileSync(path.join(root, `startup-${startup}.json`), path.join(root, "startup.json"));
    const worker = createLoaderPoolWorker({
      mode: "metro", root, cache: path.join(root, "cache"),
      session: path.join(root, "session"), metro: "unused", turbopack: "unused",
      traceRoot: trace, signal,
      ...(startup === "normal" ? {} : { prepareNative: "unused" }),
    });
    const errors: unknown[] = [];
    try {
      await operation(worker, root);
    } catch (error) {
      errors.push(error);
    } finally {
      try {
        await worker.close();
        if (["ready-error", "ready-duplicate", "malformed", "unknown", "partial", "nonzero", "cancel"].includes(name))
          errors.push(new Error("Terminal transport unexpectedly closed successfully"));
      } catch (error) {
        // Expected terminal failures still require original actual close.
        if (!worker.joined || !["ready-error", "ready-duplicate", "malformed", "unknown", "partial", "nonzero", "cancel"].includes(name))
          errors.push(error);
      }
      if (!worker.joined) errors.push(new Error("Original peer close is unknown"));
      else {
        try {
          assert.equal(fs.readFileSync(worker.diagnosticsFile, "utf8"), worker.diagnostics());
          assert.match(worker.diagnostics(), /AUTHORED_STDERR_한글/);
          assert.strictEqual(worker.close(), worker.close());
          await assert.rejects(worker.request("after-close"));
        } catch (error) {
          errors.push(error);
        }
      }
    }
    if (errors.length) throw new AggregateError(errors, name);
  });
  await peer("healthy", "normal", async (worker) => {
    const first = worker.request("hold");
    const second = worker.pluginLock({ root: "unused", api: "unused", action: "hold" });
    void first.catch(() => undefined);
    void second.catch(() => undefined);
    const barrier = await worker.request("barrier");
    assert.deepEqual(barrier.value, [1, 2]);
    assert.equal((await worker.request("release")).value, "RELEASE_ACK");
    assert.equal((await first).value, "RELEASED");
    assert.equal((await second).value, "RELEASED");
    assert.equal((await worker.request("domain-error")).error, "AUTHORED_DOMAIN_ERROR");
    const beforeSplit = worker.receivedStdoutBytes;
    const split = worker.request("split", undefined, undefined, undefined, "utf8-split-prefix");
    void split.catch(() => undefined);
    while (worker.receivedStdoutBytes === beforeSplit)
      await Promise.race([
        new Promise<void>((resolve) => setImmediate(resolve)),
        split.then(() => { throw new Error("Split reply completed before its tail was released"); }),
      ]);
    console.log("Loader UTF-8 observed prefix", JSON.stringify({
      phase: "utf8-split-prefix", beforeBytes: beforeSplit,
      prefixBytes: worker.receivedStdoutBytes,
      tailRelease: "not yet sent",
    }));
    assert.equal((await worker.request("split-release")).value, "SPLIT_RELEASED");
    assert.equal((await split).value, "한글");
    assert.equal((await worker.request("still-open")).value, "still-open");
    const pending = worker.request("hold");
    void pending.catch(() => undefined);
    await worker.request("barrier");
    const closing = worker.close();
    await assert.rejects(worker.request("after-close-begins"), /closing|closed/);
    await assert.rejects(worker.pluginLock({ root: "unused", api: "unused", action: "after-close" }), /closing|closed/);
    await assert.rejects(pending, /closed before reply/);
    await closing;
  });
  await peer("ready", "success", async (worker) => {
    await assert.rejects(worker.request("before-readiness"), /starting/);
    assert.deepEqual((await worker.ready)?.binaries, []);
    assert.equal((await worker.request("ready-delivery")).value, "ready-delivery");
  });
  await peer("ready-error", "error", async (worker) => {
    await assert.rejects(worker.ready, /AUTHORED_READY_ERROR/);
    await assert.rejects(worker.request("after-error"), /AUTHORED_READY_ERROR/);
  });
  await peer("ready-duplicate", "duplicate", async (worker) => {
    await worker.ready;
    await assert.rejects(worker.request("barrier"), /unexpected readiness/);
    await assert.rejects(worker.request("after-error"), /unexpected readiness/);
  });
  for (const action of ["malformed", "unknown", "partial", "nonzero", "normal-close"])
    await peer(action, "normal", async (worker) => {
      const expected = action === "malformed"
        ? (error: unknown) => error instanceof SyntaxError
        : action === "partial"
          ? (error: unknown) => error instanceof TypeError
          : action === "unknown" ? /unexpected response/
            : action === "nonzero" ? /status=7 signal=null/
              : /closed before reply/;
      await assert.rejects(worker.request(action), expected);
      await assert.rejects(worker.request("after-terminal"));
    });
  const controller = new AbortController();
  await peer("cancel", "normal", async (worker) => {
    const request = worker.request("hold");
    void request.catch(() => undefined);
    assert.deepEqual((await worker.request("barrier")).value, [1]);
    const reason = new Error("AUTHORED_CANCELLATION");
    controller.abort(reason);
    await assert.rejects(request, (error) => error === reason);
    await assert.rejects(worker.request("after-cancel"), (error) => error === reason);
  }, controller.signal);
  await collect("pre-abort", async () => {
    const aborted = new AbortController();
    const reason = new Error("AUTHORED_PRE_ABORT");
    aborted.abort(reason);
    assert.throws(() => createLoaderPoolWorker({
      mode: "metro", root: path.join(trace, "never-created"), cache: trace,
      session: trace, metro: "unused", turbopack: "unused", traceRoot: trace,
      signal: aborted.signal,
    }), (error) => error === reason);
    assert.equal(fs.existsSync(path.join(trace, "never-created")), false);
  });
  await collect("failed-spawn", async () => {
    const worker = createLoaderPoolWorker({
      mode: "metro", root: path.join(trace, "absent-cwd"), cache: trace,
      session: trace, metro: "unused", turbopack: "unused", traceRoot: trace,
    });
    await assert.rejects(worker.request("spawn-refused"));
    await assert.rejects(worker.close());
    assert.equal(worker.joined, true);
    await assert.rejects(worker.request("after-spawn-error"));
  });
  await collect("carrier-pre-abort", async () => {
    const controller = new AbortController();
    const reason = new Error("AUTHORED_CARRIER_PRE_ABORT");
    controller.abort(reason);
    let observed = false;
    await assert.rejects(OwnedE2eEntry.run({
      entry: path.join(fixture, "owned-entry-target.mjs"),
      args: ["success", trace], signal: controller.signal,
      observeRetirement: () => { observed = true; },
    }), (error) => error === reason);
    assert.equal(observed, false, "pre-abort precedes native owner admission");
  });
  for (const mode of ["success", "nonzero", "cancel"])
    await collect("carrier-" + mode, async () => {
      const witness = path.join(trace, "carrier-" + mode);
      fs.mkdirSync(witness);
      if (mode === "success") {
        await collect("carrier-default-inherited", async () => {
          let inheritedRetirement: string | undefined;
          const inherited = await OwnedE2eEntry.run({
            entry: path.join(fixture, "owned-entry-target.mjs"),
            args: ["success", witness, "inherited argument"],
            env: { ...process.env, TTSC_E2E_CARRIER_CONTEXT: "AUTHORED_INHERITED_CONTEXT" },
            output: "pipe",
            observeRetirement: (state) => { inheritedRetirement = state; },
          });
          assert.equal(inherited.status, 0, JSON.stringify(inherited));
          assert.match(String(inherited.stderr), /AUTHORED_CARRIER_STDERR/);
          const inheritedObserved = JSON.parse(String(inherited.stdout));
          assert.deepEqual(inheritedObserved.execArgv, process.execArgv);
          assert.deepEqual(inheritedObserved.args, ["inherited argument"]);
          assert.equal(fs.realpathSync.native(inheritedObserved.cwd), fs.realpathSync.native(process.cwd()));
          assert.equal(inheritedObserved.context, "AUTHORED_INHERITED_CONTEXT");
          assert.equal(inheritedRetirement, "joined");
          console.log("Owned entry retirement", JSON.stringify({ mode: "default-inherited", retirement: inheritedRetirement }));
        });
      }
      const execArgv = ["--no-warnings", "--conditions=ttsc-owned-carrier"];
      const cancellation = new AbortController();
      let retirement: string | undefined;
      const operation = OwnedE2eEntry.run({
        execArgv,
        entry: path.join(fixture, "owned-entry-target.mjs"),
        args: [mode, witness, "argument with space", "한글"],
        cwd: witness, env: { ...process.env, TTSC_E2E_CARRIER_CONTEXT: "AUTHORED_CONTEXT" },
        output: "pipe", signal: cancellation.signal,
        observeRetirement: (state) => { retirement = state; },
      });
      void operation.catch(() => undefined);
      if (mode === "cancel") {
        let stopWitness = () => {};
        const witnessReady = new Promise<void>((resolve) => {
          const file = path.join(witness, "descendant");
          const check = () => {
            if (fs.existsSync(file)) {
              fs.unwatchFile(file, check);
              resolve();
            }
          };
          fs.watchFile(file, { interval: 10 }, check);
          stopWitness = () => fs.unwatchFile(file, check);
          check();
        });
        try {
          await Promise.race([
            witnessReady,
            operation.then((result) => { throw new Error("Carrier exited before descendant readiness", { cause: result }); }),
          ]);
          cancellation.abort(new Error("AUTHORED_CARRIER_CANCELLATION"));
          await assert.rejects(operation);
        } finally {
          stopWitness();
          if (!cancellation.signal.aborted) cancellation.abort();
          await operation.catch(() => undefined);
        }
      } else {
        const result = await operation;
        assert.equal(result.status, mode === "success" ? 0 : 9, JSON.stringify(result));
        assert.match(String(result.stderr), /AUTHORED_CARRIER_STDERR/);
        const observed = JSON.parse(String(result.stdout));
        assert.deepEqual(observed.execArgv, execArgv);
        assert.deepEqual(observed.args, ["argument with space", "한글"]);
        assert.equal(fs.realpathSync.native(observed.cwd), fs.realpathSync.native(witness));
        assert.equal(observed.context, "AUTHORED_CONTEXT");
      }
      assert.equal(retirement, "joined");
      console.log("Owned entry retirement", JSON.stringify({ mode, retirement }));
    });
  if (failures.length) {
    try {
      TestProject.retainTemporaryDirectory(trace, "resident lifetime collection failed");
    } catch (cause) {
      failures.push(new Error("Resident lifetime fixture retention failed", { cause }));
    }
    throw new AggregateError(failures, "resident command and ordinary entry lifetime");
  }
}
