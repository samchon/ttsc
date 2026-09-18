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
