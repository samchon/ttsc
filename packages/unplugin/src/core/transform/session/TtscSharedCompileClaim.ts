import type { TtscSharedCompilePublication } from "./TtscSharedCompilePublication";

/**
 * What a worker gets when it asks its session for a compile
 * (samchon/ttsc#1390).
 *
 * `adopt` hands over another worker's publication for the same project state,
 * which the caller must still prove against its own filesystem. `compile` means
 * the caller now holds the session's lock for that state: it compiles, offers
 * only a compile whose snapshot it proved stable for publication, and releases
 * the lock in every case, so the workers waiting on it proceed. An oversized
 * publication is not stored.
 *
 * @evidence contracts/common.md#principled-implementation The discriminated union distinguishes borrowed output requiring adoption proof from an exclusive compile claim requiring publication and release.
 * @evidence contracts/common.md#clear-and-simple-design Each branch exposes only the operations its owner needs, without an optional lock field that callers could confuse with an adopted result.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Possession of a publication is not presented as proof; the documented caller obligations remain independent of the store's lock ownership.
 * @evidence contracts/common.md#meaningful-documentation The branch descriptions state adoption proof and lock release obligations, and the method comments describe their failure and repeat-call behavior.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Distinguishes transferred native-store publication from an owned publisher
 *   and lock releaser. Those capabilities hide store paths and process tokens;
 *   adoption still requires the caller's actual filesystem proof.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   TtscSharedCompileClaim only declares a shape; it has no computation at
 *   runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   TtscSharedCompileClaim only declares a shape; it has no work to reuse at
 *   runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   TtscSharedCompileClaim only declares a shape; it has no handle or
 *   retained state at runtime.
 */
export type TtscSharedCompileClaim =
  | {
      kind: "adopt";
      publication: TtscSharedCompilePublication;

      /** Digest of exactly the serialized payload read, not its projected state. */
      fingerprint: string;
    }
  | {
      kind: "compile";

      /**
       * Publish a proven compile for the waiting workers when it fits the
       * store's byte budget. Oversized output stays local. Never throws.
       */
      publish(publication: TtscSharedCompilePublication): Promise<void>;

      /** Release the lock. Never throws, and a second call does nothing. */
      release(): void;
    };
