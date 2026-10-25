import type { ITtscCompilerTransformation } from "ttsc";

/**
 * A provisional native root report tied to the config policy that learned it.
 * It predicts a later walk's settings and carries no filesystem reuse proof.
 *
 * @evidence contracts/common.md#principled-implementation A config-policy identity prevents a previously learned CLI report from overriding newly read JSON settings; capture qualifies the report against config and graph observations.
 * @evidence contracts/common.md#clear-and-simple-design One pair keeps the prediction and its premise together across attempts and cache generations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The hint is optional and does not replace the current compiler report or snapshot proof.
 * @evidence contracts/common.md#meaningful-documentation Members distinguish the config identity from the native prediction and state their authority limit.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This carrier interprets no path, platform or process value.
 * @evidenceExclude contracts/performance.md#efficient-algorithms This type declares no runtime computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This type coordinates no work; the primer and capture own prediction validity.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This type owns no handle or retained population.
 */
export interface TtscCompilerMembershipHint {
  /** Digest of the fresh JSON and overlay policy before native projection. */
  basis: string;

  /** Qualified native settings, subject to the next compiler's report. */
  report: NonNullable<
    ITtscCompilerTransformation.IReferenceGraph["membership"]
  >;
}
