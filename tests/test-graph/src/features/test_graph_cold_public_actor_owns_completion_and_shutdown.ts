import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { ColdGraphActorLifecycle } from "../../../utils/src/ColdGraphActorLifecycle";

/**
 * Verifies cold Graph actor progress and terminal shutdown use actual owners.
 *
 * A real pending operation has no test-duration result. Competing close and
 * operation-failure requests must share one terminal sequence without a queue
 * awaiting its own shutdown. These controls do not fabricate a successful
 * Graph Session; the two cold E2E scenes retain that native/artifact boundary.
 *
 * 1. Deliver progress, error, disconnect and close in contrasting orders.
 * 2. Hold shutdown, queue drain and publication with owned promises.
 * 3. Race queued failure with explicit close and retain every terminal error.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual shared observation and terminal operations with Node EventEmitter and controlled own stage promises. It asserts pending settlement, event/failure order, listener disposal, identical close promise, exactly one stage sequence and complete error identity rather than elapsed time or source shape.
 * @evidence contracts/testing.md#independent-expectations A required message delivered before failure permits that progress; failure before a missing or later message rejects it. Shutdown must precede queue drain, verification and acknowledged publication; disconnect cannot precede that publication. Literal order and original Error identities derive from those ownership requirements.
 * @evidence contracts/testing.md#distinguishing-cases Pending/already-delivered progress, failed/close-failed messages, original error/disconnect/close, earlier/later event order and disposal contrast parent outcomes. Repeated/concurrent close, pending drain/publication, queue-originated close and all five failing stages contrast terminal ownership and self-dependency. Actual E2E owns public abort/recovery, artifact/warm identity and native/resource joins.
 * @evidence contracts/testing.md#execution-ownership One discoverable graph unit imports only the actual shared test helper, never another suite's fixture or internals. All controls are in-process owned events/promises with no host, compiler, process scan, install or product-success replacement.
 */
export async function test_graph_cold_public_actor_owns_completion_and_shutdown(): Promise<void> {
  const deferred = () => {
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<void>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    return { promise, resolve, reject };
  };
  const tick = async (): Promise<void> => { await Promise.resolve(); await Promise.resolve(); };
  let acknowledge!: (error: Error | null) => void;
  const channel = {
    send(message: string | Record<string, unknown>, callback: (error: Error | null) => void): boolean {
      assert.strictEqual(this, channel);
      assert.equal(message, "close");
      acknowledge = callback;
      return false; // Backpressure is not send completion.
    },
  };
  let sent = false;
  const sending = ColdGraphActorLifecycle.send(channel, "close").then(() => { sent = true; });
  await tick();
  assert.equal(sent, false);
  acknowledge(null);
  await sending;
  assert.equal(sent, true);
  const channelError = new Error("original asynchronous channel error");
  const sendFailure = ColdGraphActorLifecycle.send(channel, "close");
  const failedSend = assert.rejects(sendFailure, (error) => error === channelError);
  acknowledge(channelError);
  await failedSend;
  await assert.rejects(ColdGraphActorLifecycle.send({}, "close"), /no original IPC channel/);
  await assert.rejects(ColdGraphActorLifecycle.send({
    send: () => { throw channelError; },
  }, "close"), (error) => error === channelError);

  const source = new EventEmitter();
  const progress = ColdGraphActorLifecycle.observe(source);
  let settled = false;
  const pending = progress.wait("recovered").then(() => { settled = true; });
  await tick();
  assert.equal(settled, false, "pending work must not manufacture an outcome");
  source.emit("message", { event: "ready" });
  await progress.wait("ready");
  source.emit("message", { event: "recovered" });
  await pending;
  assert.equal(settled, true);
  const original = new Error("original actor error");
  source.emit("error", original);
  await progress.wait("recovered");
  await assert.rejects(progress.wait("closed"), (error) => error === original);
  source.emit("message", { event: "closed" });
  await assert.rejects(progress.wait("closed"), (error) => error === original);
  progress.dispose();
  for (const event of ["message", "error", "disconnect", "close"])
    assert.equal(source.listenerCount(event), 0, event);

  for (const event of ["failed", "close-failed", "disconnect", "close"] as const) {
    const emitter = new EventEmitter();
    const observation = ColdGraphActorLifecycle.observe(emitter);
    const wait = observation.wait("recovered");
    const rejected = assert.rejects(wait, /Public session actor/);
    if (event === "failed" || event === "close-failed")
      emitter.emit("message", { event, diagnostic: "retained failure" });
    else emitter.emit(event);
    await rejected;
    observation.dispose();
  }
  const disposedSource = new EventEmitter();
  const disposed = ColdGraphActorLifecycle.observe(disposedSource);
  const disposedWait = assert.rejects(disposed.wait("ready"), /disposed/);
  disposed.dispose();
  await disposedWait;

  const closing = deferred(), drained = deferred(), publication = deferred();
  const closeStarted = deferred(), drainStarted = deferred(), publishStarted = deferred();
  const stages: string[] = [];
  const terminal = ColdGraphActorLifecycle.terminal({
    close: async () => { stages.push("close"); closeStarted.resolve(); await closing.promise; },
    drain: async () => { stages.push("drain"); drainStarted.resolve(); await drained.promise; },
    verify: async () => { stages.push("verify"); },
    publish: async (failures) => {
      assert.deepEqual(failures, []);
      assert.equal(Object.isFrozen(failures), true);
      stages.push("publish");
      publishStarted.resolve();
      await publication.promise;
    },
    disconnect: () => { stages.push("disconnect"); },
  });
  const first = terminal();
  assert.strictEqual(terminal(), first);
  await closeStarted.promise;
  assert.deepEqual(stages, ["close"]);
  closing.resolve();
  await drainStarted.promise;
  assert.deepEqual(stages, ["close", "drain"]);
  drained.resolve();
  await publishStarted.promise;
  assert.deepEqual(stages, ["close", "drain", "verify", "publish"]);
  assert.strictEqual(terminal(), first);
  publication.resolve();
  await first;
  assert.deepEqual(stages, ["close", "drain", "verify", "publish", "disconnect"]);
  assert.strictEqual(terminal(), first);

  const operation = deferred();
  const operationError = new Error("owned queued operation failed");
  const raced: string[] = [];
  let requestedFromQueue: Promise<void> | undefined;
  let queue = Promise.resolve();
  const finish = ColdGraphActorLifecycle.terminal({
    close: async () => { raced.push("close"); operation.reject(operationError); },
    drain: async () => { raced.push("drain"); await queue; },
    verify: async () => { raced.push("verify"); },
    publish: async () => { raced.push("publish"); },
    disconnect: () => { raced.push("disconnect"); },
  });
  queue = operation.promise.catch((error) => {
    assert.strictEqual(error, operationError);
    raced.push("failed");
    requestedFromQueue = finish();
    // Returning, rather than awaiting finish(), lets its drain join this queue.
  });
  const explicit = finish();
  await explicit;
  assert.strictEqual(requestedFromQueue, explicit);
  assert.deepEqual(raced, ["close", "failed", "drain", "verify", "publish", "disconnect"]);

  const errors = ["shutdown", "drain", "verification", "publication", "disconnect"]
    .map((stage) => new Error(stage));
  const failureStages: string[] = [];
  const broken = ColdGraphActorLifecycle.terminal({
    close: async () => { failureStages.push("close"); throw errors[0]; },
    drain: async () => { failureStages.push("drain"); throw errors[1]; },
    verify: async () => { failureStages.push("verify"); throw errors[2]; },
    publish: async (failures) => {
      failureStages.push("publish");
      assert.deepEqual(failures, errors.slice(0, 3));
      throw errors[3];
    },
    disconnect: () => { failureStages.push("disconnect"); throw errors[4]; },
  });
  const brokenResult = broken();
  await assert.rejects(brokenResult, (error) => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, errors);
    return true;
  });
  assert.strictEqual(broken(), brokenResult);
  assert.deepEqual(failureStages, ["close", "drain", "verify", "publish", "disconnect"]);
}
