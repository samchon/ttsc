import type { transformProjectInMemory } from "./transformProjectInMemory";

/**
 * A transform worker thread's answer to one
 * {@link TransformProjectWorkerRequest}.
 *
 * `output` is what {@link transformProjectInMemory} returned. `thrown` describes
 * what it threw instead. The shared error serializer preserves selected Error
 * fields, enumerable custom data, causal failures and partial outcomes rather
 * than relying on native Error cloning, which can drop aggregate failures. It
 * describes repeated references and exceptional values with markers rather than
 * preserving prototypes or every hidden property. A completed reply contains
 * one branch; worker death or cloning failure can reject separately without
 * delivering this envelope.
 *
 * @evidence contracts/common.md#principled-implementation Mutually exclusive output and thrown envelopes distinguish successful transform data from finite serialized causal failure graphs, including aggregate errors and partial compile outcomes that native Error cloning can omit.
 * @evidence contracts/common.md#clear-and-simple-design One discriminated union carries the existing transform result or the shared serializer's unknown-valued description; API and worker failures use one causal-data policy rather than reconstructing only an outer Error message.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Exceptions remain failures with their original description rather than being converted to empty transform output or success-shaped default data.
 * @evidence contracts/common.md#meaningful-documentation The native paragraph explains both branches and the nonobvious custom-name transport requirement, following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation The output branch carries transform result native path coordinates, input realpaths and graph/source identities across structured cloning without shell parsing or OS-name case reinterpretation. Exceptional values use the shared serializer's data markers; the carrier does not independently interpret native paths or reconstruct platform Error prototypes.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
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
