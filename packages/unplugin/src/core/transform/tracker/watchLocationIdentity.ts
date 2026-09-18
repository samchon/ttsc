import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";

/**
 * The device and file id a watched directory resolves to, or `undefined` when
 * it cannot be read.
 *
 * Followed through links, because a watch opens on the directory a spelling
 * resolves to: a retargeted link and a replaced directory both change it, and
 * that is exactly the change a watch cannot report about itself.
 */
export function watchLocationIdentity(
  directory: string,
  filesystem: TtscTransformFilesystemOperations,
): string | undefined {
  try {
    const stats = filesystem.statBigInt(directory);
    if (!stats.isDirectory()) return undefined;
    return `${stats.dev}:${stats.ino}`;
  } catch {
    return undefined;
  }
}
