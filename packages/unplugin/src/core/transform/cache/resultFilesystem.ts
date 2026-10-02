import type { ITtscCompilerTransformation } from "ttsc";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { TRANSFORM_RESULT_FILESYSTEM } from "./TRANSFORM_RESULT_FILESYSTEM";

/**
 * Return the filesystem view one compiler result is validated against.
 *
 * A generation must be re-proven through the same view it was captured through:
 * an embedder that observes another filesystem supplies its own operations, and
 * mixing them with host reads would compare state from two different
 * filesystems. Results captured without a registered view fall back to the host
 * filesystem.
 *
 * @evidence contracts/common.md#principled-implementation Validation retrieves the result's captured filesystem view, avoiding proof assembled from the producer's injected state and unrelated native reads.
 * @evidence contracts/common.md#clear-and-simple-design A result-keyed WeakMap lookup selects the existing operations table, with one native default for unregistered results.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The operation does not patch host filesystem methods or assume that an injected filesystem is the native one.
 * @evidence contracts/common.md#meaningful-documentation The comment explains why capture and validation must use the same filesystem view and states the unregistered-result default.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Retains nothing; the table is weakly keyed by the result.
 * @evidenceExclude contracts/performance.md#efficient-algorithms One WeakMap lookup.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The lookup returns the view a result was captured through; there is no computation to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Performs no filesystem, path or process operation of its own.
 */
export function resultFilesystem(
  result: ITtscCompilerTransformation,
): TtscTransformFilesystemOperations {
  return (
    TRANSFORM_RESULT_FILESYSTEM.get(result) ?? DEFAULT_FILESYSTEM_OPERATIONS
  );
}
