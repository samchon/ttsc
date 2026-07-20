import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { createCompilerClient } from "../../../../packages/playground/lib/src/react/createCompilerClient.js";

interface IControlledConnector {
  close(): Promise<void>;
  connect(): Promise<void>;
  getDriver(): { connectorId: number };
}

interface IWorkerConnectorConstructor {
  prototype: IControlledConnector;
}

interface IGate {
  reject(error: Error): void;
  resolve(): void;
}

interface IRecord {
  closeCount: number;
  id: number;
}

/**
 * Verifies playground compiler client: fences overlapping connection
 * generations.
 *
 * A reset invalidates its generation before awaiting connection settlement. A
 * replacement that resolves or becomes current while that cleanup is pending
 * must remain cached and reachable; otherwise a wasm Worker leaks and a later
 * retry allocates a duplicate connection.
 *
 * 1. Settle replacement B before original A, then settle and reject A in separate
 *    orderings while resets overlap both attempts.
 * 2. Assert each invalidated connector closes exactly once and B remains the
 *    shared cached connection until its own reset.
 */
export const test_compiler_client_fences_connection_generations = async () => {
  // `createCompilerClient` compiles to CommonJS, so load tgrid through the same
  // CJS module cache rather than importing tgrid's separate ESM entry point.
  const { WorkerConnector } = createRequire(import.meta.url)("tgrid") as {
    WorkerConnector: IWorkerConnectorConstructor;
  };
  const prototype = WorkerConnector.prototype;
  const originals = {
    close: prototype.close,
    connect: prototype.connect,
    getDriver: prototype.getDriver,
  };
  const gates: IGate[] = [];
  const records = new Map<object, IRecord>();
  const throwOnClose = new Set<number>();
  let nextId = 0;
  const recordOf = (connector: object): IRecord => {
    let record = records.get(connector);
    if (!record) {
      record = { closeCount: 0, id: ++nextId };
      records.set(connector, record);
    }
    return record;
  };

  prototype.connect = function (): Promise<void> {
    recordOf(this);
    return new Promise<void>((resolve, reject) =>
      gates.push({ resolve, reject }),
    );
  };
  prototype.getDriver = function (): { connectorId: number } {
    return { connectorId: recordOf(this).id };
  };
  prototype.close = async function (): Promise<void> {
    const record = recordOf(this);
    record.closeCount++;
    if (throwOnClose.has(record.id)) throw new Error("close failed");
  };
  const waitForGates = async (count: number): Promise<void> => {
    for (let attempt = 0; attempt < 20 && gates.length < count; attempt++)
      await Promise.resolve();
    assert.equal(gates.length, count, `expected ${count} controlled connects`);
  };

  try {
    // B settles before A. A is only ever owned by the reset that invalidated it.
    const firstClient = createCompilerClient({ workerUrl: "worker.js" });
    const a = firstClient.connect();
    await waitForGates(1);
    const resetA = firstClient.reset();
    const b = firstClient.connect();
    await waitForGates(2);
    gates[1]!.resolve();
    const bDriver = await b;
    gates[0]!.resolve();
    await Promise.all([a, resetA]);
    const cachedB = firstClient.connect();
    assert.strictEqual(cachedB, b, "B must remain the cached generation");
    await firstClient.reset();

    // A rejects only after B has been returned. Its rejection must not clear B.
    const secondClient = createCompilerClient({ workerUrl: "worker.js" });
    const rejectionStart = gates.length;
    const rejectedA = secondClient.connect().catch((error: unknown) => error);
    await waitForGates(rejectionStart + 1);
    const resetRejectedA = secondClient.reset();
    const secondB = secondClient.connect();
    await waitForGates(rejectionStart + 2);
    gates[rejectionStart + 1]!.resolve();
    const secondBDriver = await secondB;
    gates[rejectionStart]!.reject(new Error("boot failed"));
    await rejectedA;
    await resetRejectedA;
    assert.strictEqual(
      secondClient.connect(),
      secondB,
      "a stale rejection must not discard B's cache",
    );
    await secondClient.reset();

    // Concurrent resets share the invalidated generation instead of double-close.
    const concurrentClient = createCompilerClient({ workerUrl: "worker.js" });
    const concurrentStart = gates.length;
    const connection = concurrentClient.connect();
    await waitForGates(concurrentStart + 1);
    gates[concurrentStart]!.resolve();
    await connection;
    await Promise.all([concurrentClient.reset(), concurrentClient.reset()]);

    // A failed current generation clears the cache and closes its connector, so
    // retry remains possible without orphaning the failed Worker. reset() also
    // continues through a close failure.
    const retryClient = createCompilerClient({ workerUrl: "worker.js" });
    await retryClient.reset();
    const failureStart = gates.length;
    const failed = retryClient.connect();
    await waitForGates(failureStart + 1);
    gates[failureStart]!.reject(new Error("normal boot failure"));
    await assert.rejects(failed, /normal boot failure/);
    const retried = retryClient.connect();
    await waitForGates(failureStart + 2);
    gates[failureStart + 1]!.resolve();
    const retryDriver = await retried;
    throwOnClose.add(retryDriver.connectorId);
    await retryClient.reset();

    const counts = [...records.values()].map((record) => record.closeCount);
    assert.deepEqual(
      counts,
      [1, 1, 1, 1, 1, 1, 1],
      "each allocated connector must remain reachable until one close",
    );
    assert.deepEqual(bDriver, { connectorId: 2 });
    assert.deepEqual(secondBDriver, { connectorId: 4 });
    assert.deepEqual(retryDriver, { connectorId: 7 });
  } finally {
    prototype.close = originals.close;
    prototype.connect = originals.connect;
    prototype.getDriver = originals.getDriver;
  }
};
