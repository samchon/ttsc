"use client";

import { WorkerConnector } from "tgrid";

import type { ICompilerService } from "../structures/ICompilerService";
import type { ICreateCompilerClientOptions } from "../structures/ICreateCompilerClientOptions";

/**
 * UI-side singleton: connect to the playground worker over tgrid and return
 * the typed `ICompilerService` driver.
 *
 * The promise is cached; the first call boots, every subsequent call shares
 * the same connection. If the boot rejects the cache is cleared so the next
 * call retries — otherwise every retry would resolve to the same rejection.
 */
export function createCompilerClient(
  options: ICreateCompilerClientOptions,
): { connect(): Promise<ICompilerService>; reset(): Promise<void> } {
  let connectionPromise: Promise<ICompilerService> | null = null;
  // Track the active connector AND the in-flight connector promise so
  // reset() can dispose either one — disposing only the resolved
  // `activeConnector` leaks the connector when reset() is called during
  // an in-flight `await connector.connect(...)` (the connector reference
  // exists but isn't yet assigned to activeConnector).
  let activeConnector: WorkerConnector<null, null, null> | null = null;
  let pendingConnector: Promise<WorkerConnector<null, null, null>> | null =
    null;

  return {
    connect(): Promise<ICompilerService> {
      if (connectionPromise) return connectionPromise;
      const connector: WorkerConnector<null, null, null> = new WorkerConnector(
        null,
        null,
      );
      const connectPromise = connector
        .connect(options.workerUrl)
        .then(() => connector);
      pendingConnector = connectPromise;
      connectionPromise = (async () => {
        try {
          await connectPromise;
        } catch (err) {
          connectionPromise = null;
          if (pendingConnector === connectPromise) pendingConnector = null;
          throw err;
        }
        if (pendingConnector === connectPromise) pendingConnector = null;
        activeConnector = connector;
        return connector.getDriver() as unknown as ICompilerService;
      })();
      return connectionPromise;
    },
    async reset(): Promise<void> {
      const inflight = pendingConnector;
      const active = activeConnector;
      connectionPromise = null;
      pendingConnector = null;
      activeConnector = null;
      // Swallow close errors: the worker is already being torn down,
      // and a Retry that fails to close cleanly should not block the
      // next connect attempt. Cover both code paths — the in-flight
      // connector (await it first, then close) and the resolved active
      // connector. Either may be null; both may be the same instance
      // after a successful connect().
      if (inflight) {
        try {
          const c = await inflight;
          if (c !== active) await c.close().catch(() => {});
        } catch {
          // connect() rejected — nothing to close.
        }
      }
      if (active) {
        await active.close().catch(() => {});
      }
    },
  };
}
