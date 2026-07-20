"use client";

import { WorkerConnector } from "tgrid";

import type { ICompilerService } from "../structures/ICompilerService";
import type { ICreateCompilerClientOptions } from "../structures/ICreateCompilerClientOptions";

/**
 * UI-side singleton: connect to the playground worker over tgrid and return the
 * typed `ICompilerService` driver.
 *
 * One connection generation owns the cached promise and connector. A reset
 * invalidates that generation before awaiting it, so a late settlement cannot
 * replace a newer connection or clear its retry state.
 */
export function createCompilerClient(options: ICreateCompilerClientOptions): {
  connect(): Promise<ICompilerService>;
  reset(): Promise<void>;
} {
  type Connection = {
    connector: WorkerConnector<null, null, null>;
    close(): Promise<void>;
    promise: Promise<ICompilerService>;
  };
  let current: Connection | null = null;

  return {
    connect(): Promise<ICompilerService> {
      if (current) return current.promise;
      const connector: WorkerConnector<null, null, null> = new WorkerConnector(
        null,
        null,
      );
      let closePromise: Promise<void> | null = null;
      const connection = {} as Connection;
      current = connection;
      connection.connector = connector;
      connection.close = () =>
        (closePromise ??= Promise.resolve()
          .then(() => connector.close())
          .catch(() => {}));
      connection.promise = Promise.resolve()
        .then(() => connector.connect(options.workerUrl))
        .then(() => connector.getDriver() as unknown as ICompilerService)
        .catch(async (error: unknown) => {
          if (current === connection) {
            current = null;
            await connection.close();
          }
          throw error;
        });
      return connection.promise;
    },
    async reset(): Promise<void> {
      const invalidated = current;
      current = null;
      if (!invalidated) return;
      try {
        await invalidated.promise;
      } catch {
        // A rejected connection never became usable.
      }
      await invalidated.close();
    },
  };
}
