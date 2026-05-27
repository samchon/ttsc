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
  // Track the active connector so reset() can tear down the Worker —
  // otherwise every Retry click leaks a Worker (and the wasm instance it
  // owns) into the background. The generic `Remote` parameter is `null`
  // because the worker doesn't expose a remote object; the typed service
  // surface is obtained via `getDriver<ICompilerService>()` instead.
  let activeConnector: WorkerConnector<null, null, null> | null = null;

  return {
    connect(): Promise<ICompilerService> {
      if (connectionPromise) return connectionPromise;
      connectionPromise = (async () => {
        const connector: WorkerConnector<null, null, null> =
          new WorkerConnector(null, null);
        try {
          await connector.connect(options.workerUrl);
        } catch (err) {
          connectionPromise = null;
          throw err;
        }
        activeConnector = connector;
        return connector.getDriver() as unknown as ICompilerService;
      })();
      return connectionPromise;
    },
    async reset(): Promise<void> {
      connectionPromise = null;
      const connector = activeConnector;
      activeConnector = null;
      if (connector) {
        // Swallow close errors: the worker is already being torn down,
        // and a Retry that fails to close cleanly should not block the
        // next connect attempt.
        await connector.close().catch(() => {});
      }
    },
  };
}
