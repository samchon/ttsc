import type { transformProjectInMemory } from "./transformProjectInMemory";

/**
 * A transform worker thread's answer to one
 * {@link TransformProjectWorkerRequest} (samchon/ttsc#1391).
 *
 * `output` is what {@link transformProjectInMemory} returned. `thrown` describes
 * what it threw instead. A structured clone keeps an `Error`'s `name` only for
 * the built-in error classes, so the worker sends the parts the exception
 * envelope reads, and the calling thread rebuilds the error from them.
 */
export type TransformProjectWorkerReply =
  | {
      output: ReturnType<typeof transformProjectInMemory>;
    }
  | {
      thrown: {
        message: string;
        name?: string;
        stack?: string;
      };
    };
