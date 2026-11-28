import { RuntimeFilesystem } from "../../../launcher/internal/runtime/RuntimeFilesystem";

/**
 * Resolve a declared plugin or contributor source before selecting its Go
 * module. An unavailable lookup retains the declaration for source diagnostics.
 * A non-UTF-8 physical path cannot supply the ancestry used for module
 * selection.
 *
 * @evidence contracts/common.md#principled-implementation Lossless native realpath qualifies the physical source used by admission, module discovery or copying.
 * @evidence contracts/common.md#clear-and-simple-design The plugin loader and contributor validator share the same physical source boundary.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An undecodable path cannot select its UTF-8 lookalike, and a failed lookup retains the declaration for the normal missing-source check.
 * @evidence contracts/common.md#meaningful-documentation The prose distinguishes unavailable lookup from an unsupported physical address.
 * @evidence contracts/portability.md#os-neutral-implementation Native realpath preserves Windows paths and checks POSIX realpath bytes before string-based ancestry processing.
 * @evidence contracts/performance.md#efficient-algorithms One realpath attempt and POSIX path encoding require no source file read or enumeration.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each load observes current alias topology.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The helper returns text and keeps no handle or previous result.
 */
export function resolvePluginSourcePath(
  source: string,
  owner: "plugin source" | "contributor source",
): string {
  let physical: string;
  try {
    physical = RuntimeFilesystem.realpathWitness(source);
  } catch {
    return source;
  }
  if (physical.includes("\0"))
    throw new Error(`ttsc: ${owner} has no UTF-8 physical path: ${source}`);
  return physical;
}
