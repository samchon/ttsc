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
 *
 * @evidence contracts/common.md#principled-implementation Each connection record owns its promise and connector; identity-checked failure eviction and invalidation-before-await prevent old settlements from replacing a newer generation.
 * @evidence contracts/common.md#clear-and-simple-design A factory closure exposes only connect and reset while keeping transport state private; close sharing prevents duplicate disposal.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Worker replacement uses tgrid's connector API; ordinary connection rejection remains failure rather than a synthetic driver.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs define promise ownership and stale-settlement behavior under the documentation skill; reset may wait for an underlying connection that tgrid does not expose cancellation for.
 * @evidence contracts/performance.md#efficient-algorithms Connection state and identity checks use constant space and work independent of request count; transport startup is delegated to one connector per generation.
 * @evidence contracts/performance.md#reuse-equivalent-work Calls in one client generation share its connection promise and driver; reset invalidates that identity before waiting, and failed current connections are evicted. A new client URL belongs to a separate factory instance.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The connection record owns its connector and memoized close promise; reset clears current ownership then awaits settlement and closes once. Concurrent explicit resets can have outstanding old generations, and tgrid exposes no cancellation for a still-pending connection, so disposal can wait for its settlement.
  * @evidenceExclude contracts/portability.md#os-neutral-implementation Browser UI logic with no native filesystem, path-identity or process boundary.
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
