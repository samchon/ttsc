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
): { connect(): Promise<ICompilerService>; reset(): void } {
  let connectionPromise: Promise<ICompilerService> | null = null;

  return {
    connect(): Promise<ICompilerService> {
      if (connectionPromise) return connectionPromise;
      connectionPromise = (async () => {
        const connector = new WorkerConnector(null, null);
        try {
          await connector.connect(options.workerUrl);
        } catch (err) {
          connectionPromise = null;
          throw err;
        }
        return connector.getDriver<ICompilerService>();
      })();
      return connectionPromise;
    },
    reset(): void {
      connectionPromise = null;
    },
  };
}
