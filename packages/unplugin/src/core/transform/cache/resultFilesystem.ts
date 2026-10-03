import type { ITtscCompilerTransformation } from "ttsc";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { TRANSFORM_RESULT_FILESYSTEM } from "./TRANSFORM_RESULT_FILESYSTEM";

/**
 * Return the filesystem view one compiler result is validated against.
 *
 * Capture and delivery owners register the operations view used for validation.
 * They must keep that view coherent with the recorded observations; this lookup
 * does not independently verify equivalence when a registration is replaced.
 * Mixing an injected view with unrelated host reads would compare different
 * filesystem states. Unregistered results fall back to the host filesystem.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Validation retrieves the result's registered operations instead of silently
 *   substituting host reads. Capture and delivery registration own view coherence;
 *   this selector alone does not establish that prerequisite.
 * @evidence contracts/common.md#clear-and-simple-design A result-keyed WeakMap lookup selects the existing operations table, with one native default for unregistered results.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The operation does not patch host filesystem methods or assume that an injected filesystem is the native one.
 * @evidence contracts/common.md#meaningful-documentation The comment explains why capture and validation must use the same filesystem view and states the unregistered-result default.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Retains nothing; the table is weakly keyed by the result.
 * @evidenceExclude contracts/performance.md#efficient-algorithms One WeakMap lookup.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   This selects an already registered operations table. Capture and delivery
 *   owners govern registration and proof equivalence; no verdict is cached here.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Selects the registered native filesystem capability boundary, including its
 *   path grammar, case policy and observation methods. Only unregistered results
 *   select the explicit host default; no OS name establishes view equivalence.
 */
export function resultFilesystem(
  result: ITtscCompilerTransformation,
): TtscTransformFilesystemOperations {
  return (
    TRANSFORM_RESULT_FILESYSTEM.get(result) ?? DEFAULT_FILESYSTEM_OPERATIONS
  );
}
