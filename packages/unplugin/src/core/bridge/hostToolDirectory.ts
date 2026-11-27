import path from "node:path";

/**
 * Name the ignored cache that owns a build host's persistent project records.
 * The path remains below the selected host root for hosts that constrain file
 * dependencies to it. Farm uses its separate same-volume record channel.
 *
 * @param root The build host's effective filesystem root.
 * @evidence contracts/common.md#principled-implementation The path remains below the supplied host root and places the record protocol under its node_modules cache.
 * @evidence contracts/common.md#clear-and-simple-design One naming function serves every host that accepts the default record path; filesystem admission belongs to the record writer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The automatic record path cannot target a regular project directory.
 * @evidence contracts/common.md#meaningful-documentation The native comment states the placement rule and why Farm uses a different route.
 * @evidence contracts/portability.md#os-neutral-implementation Native join preserves root spelling and volume before host dependency registration.
 * @evidence contracts/performance.md#efficient-algorithms One native join processes the supplied path text without touching the filesystem.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Naming a path coordinates no completed work.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The selector creates no directory or retained state.
 */
export function hostToolDirectory(root: string): string {
  return path.join(root, "node_modules", ".cache", "ttsc", "unplugin");
}
