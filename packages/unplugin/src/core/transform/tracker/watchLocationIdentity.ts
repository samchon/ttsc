import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";

/**
 * The device and file id a watched directory resolves to, or `undefined` when
 * it cannot be read.
 *
 * Followed through links, because a watch opens on the directory a spelling
 * resolves to: a retargeted link and a replaced directory both change it, and
 * that is exactly the change a watch cannot report about itself.
 *
 * @param seen Identities already read during one verification, by directory. A
 *   generation's trackers watch the same project root, so sharing one map
 *   across them makes a delivery read each watched directory once rather than
 *   once per tracker.
 * @evidence contracts/common.md#principled-implementation
 *   Followed bigint device/inode pairs identify the directory actually watched;
 *   unreadable paths and non-directories cannot supply identity authority.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One metadata boundary returns identity or absence, with an optional
 *   caller-owned verification memo instead of global state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Failure remains absence; path spelling, cached generation age or a guessed
 *   filesystem case rule never substitutes for native directory identity.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain followed links and delivery-local memo ownership,
 *   following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral code uses the supplied filesystem's bigint physical identity
 *   without platform-wide case folding or assumptions about alias spellings.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Each call performs expected entry-count map work and at most one supplied
 *   metadata read. Directory-key hashing, native path resolution and bigint
 *   decimal formatting retain their string/component/digit costs.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   A verification map shares both successful and absent identities for the
 *   same directory within one verification; has distinguishes a cached absence
 *   from no observation. A later delivery receives a fresh verification map.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The caller owns the memo's verification lifetime; this helper acquires no
 *   persistent resource or independent cache.
 */
export function watchLocationIdentity(
  directory: string,
  filesystem: TtscTransformFilesystemOperations,
  seen?: Map<string, string | undefined>,
): string | undefined {
  if (seen?.has(directory) === true) return seen.get(directory);
  let identity: string | undefined;
  try {
    const stats = filesystem.statBigInt(directory);
    if (stats.isDirectory()) identity = `${stats.dev}:${stats.ino}`;
  } catch {
    // An unreadable location has no identity.
  }
  seen?.set(directory, identity);
  return identity;
}
