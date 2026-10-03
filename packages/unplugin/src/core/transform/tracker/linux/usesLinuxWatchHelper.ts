import type { TtscTransformFilesystemOperations } from "../../filesystem/TtscTransformFilesystemOperations";

/**
 * Whether a tracker over `filesystem` opens its watches in the Linux watch
 * helper rather than through `fs.watch` (samchon/ttsc#1426).
 *
 * The host filesystem on every platform but Windows and macOS does, since those
 * two watch in the isolated broker instead. An embedder that supplies its own
 * `watch` retains that capability, including for a host-filesystem view.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A custom watcher keeps authority over its filesystem. Other native hosts
 *   attempt the helper and must treat an unavailable helper as failed coverage.
 * @evidence contracts/common.md#clear-and-simple-design
 *   This predicate owns backend routing only; startup and availability checks
 *   remain in getLinuxWatchHelper.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Non-broker routing does not certify helper availability or replace a custom
 *   implementation merely because a host has a particular platform name.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs distinguish native routing from an embedder's watcher,
 *   following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral callers retain injected filesystem behavior; explicit platform
 *   routing is confined to the native implementation boundary.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Retains nothing.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Constant-time comparisons.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A pure predicate over the filesystem view and the platform.
 */
export function usesLinuxWatchHelper(
  filesystem: TtscTransformFilesystemOperations,
): boolean {
  return (
    filesystem.watch === undefined &&
    (filesystem.platform === undefined ||
      filesystem.platform === process.platform) &&
    process.platform !== "win32" &&
    process.platform !== "darwin"
  );
}
