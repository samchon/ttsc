import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { inputMetadataEvidence } from "./inputMetadataEvidence";

/**
 * Extract the current lexical-path and target metadata signature, or undefined
 * when metadata cannot be observed. Matching signatures alone do not authorize
 * content reuse: the caller must also establish clock separability and coverage.
 *
 * @evidence contracts/common.md#principled-implementation Optional extraction preserves unavailable evidence instead of inventing a missing-path signature, while metadata semantics stay with inputMetadataEvidence.
 * @evidence contracts/common.md#clear-and-simple-design This adapter exposes just the signature to callers that own their separate reuse conditions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Signature equality is not promoted into unconditional byte equality or silent-watcher proof.
 * @evidence contracts/common.md#meaningful-documentation Native prose corrects the signature-only reuse implication and states unavailable metadata, with separated tags following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral metadata comes from the supplied following and nonfollowing capabilities; this wrapper adds no path or case assumptions.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Retains nothing; it returns a string.
 * @evidenceExclude contracts/performance.md#efficient-algorithms One lstat and at most one stat, through inputMetadataEvidence.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A signature is recomputed per proof; whether it may stand for content is decided by its callers against a fresh clock reference.
 */
export function inputMetadataSignature(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): string | undefined {
  return inputMetadataEvidence(file, filesystem)?.signature;
}
