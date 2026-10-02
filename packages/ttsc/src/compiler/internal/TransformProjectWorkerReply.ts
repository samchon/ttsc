import type { transformProjectInMemory } from "./transformProjectInMemory";

/**
 * A transform worker thread's answer to one
 * {@link TransformProjectWorkerRequest}.
 *
 * `output` is what {@link transformProjectInMemory} returned. `thrown` describes
 * what it threw instead. The shared error serializer preserves custom Error
 * fields, causal failures and partial outcomes as structured data rather than
 * relying on native Error cloning, which can drop aggregate failures.
 *
 * @evidence contracts/common.md#principled-implementation Mutually exclusive output and thrown envelopes distinguish successful transform data from finite serialized causal failure graphs, including aggregate errors and partial compile outcomes that native Error cloning can omit.
 * @evidence contracts/common.md#clear-and-simple-design One discriminated union carries the existing transform result or the shared serializer's unknown-valued description; API and worker failures use one causal-data policy rather than reconstructing only an outer Error message.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Exceptions remain failures with their original description rather than being converted to empty transform output or success-shaped default data.
 * @evidence contracts/common.md#meaningful-documentation The native paragraph explains both branches and the nonobvious custom-name transport requirement, following the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
 */
export type TransformProjectWorkerReply =
  | {
      /** The complete synchronous transform result, copied back to its caller. */
      output: ReturnType<typeof transformProjectInMemory>;
    }
  | {
      /**
       * Finite causal description from serializeCompilerError, preserved by the
       * caller.
       */
      thrown: unknown;
    };
