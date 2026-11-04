import { DEFAULT_FILESYSTEM_OPERATIONS } from "./DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "./TtscTransformFilesystemOperations";

/**
 * Establish that a consumer observes the native input view its compiler used. A
 * copied default table preserves that authority; substituted input operations
 * have no equivalent-view certificate. Watch callbacks do not replace inputs.
 *
 * @evidence contracts/common.md#principled-implementation Every frozen native input capability must retain its reference and native path/case policy must remain selected; this connects the consumer view to native compiler reads before freshness-only delivery.
 * @evidence contracts/common.md#clear-and-simple-design One predicate checks the existing operation table without adding a claimed-equivalence option or probing filesystem contents.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown wrappers and unavailable capabilities retain ordinary proof rather than borrowing native authority; no plugin, path or test identity determines admission.
 * @evidence contracts/common.md#meaningful-documentation Prose distinguishes copied tables, substituted input operations and independent watch callbacks.
 * @evidence contracts/portability.md#os-neutral-implementation Actual native operation references establish input semantics; an explicit path dialect must match the current process and a supplied case-policy implementation remains uncertified. No OS name establishes a volume's case behavior.
 * @evidence contracts/performance.md#efficient-algorithms One fixed native-operation table is enumerated and references are compared; no input paths, source bytes or capabilities are queried.
 * @evidence contracts/performance.md#reuse-equivalent-work The frozen default capabilities are borrowed across calls, while the supplied view is checked afresh without retaining a verdict across possible changes.
 * @evidence contracts/performance.md#bound-retention-and-release-resources A fixed call-local entry array follows the synchronous comparison; no input history, callback ownership or native handle is retained.
 */
export function matchesNativeCompilerSnapshotFilesystem(
  filesystem: TtscTransformFilesystemOperations,
): boolean {
  if (
    filesystem.caseSensitive !== undefined ||
    (filesystem.platform !== undefined &&
      filesystem.platform !== process.platform)
  )
    return false;
  return Object.entries(DEFAULT_FILESYSTEM_OPERATIONS).every(
    ([name, operation]) =>
      filesystem[name as keyof TtscTransformFilesystemOperations] === operation,
  );
}
