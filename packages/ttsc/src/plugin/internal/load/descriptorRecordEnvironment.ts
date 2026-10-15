import { SidecarEnvironment } from "../../../compiler/internal/sharedHost/SidecarEnvironment";

/**
 * Supplies a descriptor child with this load's selected record root. An absent
 * store removes inherited spellings of the private channel, including Windows
 * case aliases, so a nested child cannot adopt an earlier load's cache root.
 *
 * @evidence contracts/common.md#principled-implementation The selected store is the only authority for the child channel; SidecarEnvironment.write removes inherited aliases when it is absent.
 * @evidence contracts/common.md#clear-and-simple-design One environment constructor serves direct and ttsx descriptor evaluators and their cache identity.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The helper copies the caller's environment and changes only ttsc's private channel instead of mutating process.env or inventing a cache root.
 * @evidence contracts/common.md#meaningful-documentation The comment identifies ownership of the channel and the nested-process failure prevented by clearing it.
 * @evidence contracts/portability.md#os-neutral-implementation SidecarEnvironment applies Windows native case-insensitive identity while preserving POSIX variable spelling.
 * @evidence contracts/performance.md#efficient-algorithms Copying E environment entries and removing matching Windows aliases takes O(E) time and memory; descriptor setup already materializes an environment for each child.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The selected store and effective environment are invocation-specific, so no prior constructed child environment is reused.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned environment lives only with one descriptor spawn or cache identity and retains no external resource.
 */
export function descriptorRecordEnvironment(
  env: NodeJS.ProcessEnv,
  recordRoot: string | undefined,
): NodeJS.ProcessEnv {
  const child = { ...env };
  SidecarEnvironment.write(child, "TTSC_PLUGIN_RECORD_ROOT", recordRoot);
  return child;
}
