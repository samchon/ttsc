import type { TtscSharedCompilePublication } from "./TtscSharedCompilePublication";

/**
 * What a worker gets when it asks its session for a compile
 * (samchon/ttsc#1390).
 *
 * `adopt` hands over another worker's publication for the same project state,
 * which the caller must still prove against its own filesystem. `compile` means
 * the caller now holds the session's lock for that state: it compiles,
 * publishes only a compile whose snapshot it proved stable, and releases the
 * lock in every case, so the workers waiting on it proceed.
 */
export type TtscSharedCompileClaim =
  | {
      kind: "adopt";
      publication: TtscSharedCompilePublication;
    }
  | {
      kind: "compile";
      /** Publish a proven compile for the waiting workers. Never throws. */
      publish(publication: TtscSharedCompilePublication): Promise<void>;
      /** Release the lock. Never throws, and a second call does nothing. */
      release(): void;
    };
