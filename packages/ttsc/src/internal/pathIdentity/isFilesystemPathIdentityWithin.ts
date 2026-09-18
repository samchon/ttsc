import path from "node:path";

/**
 * Whether `candidate` equals `root` or lies beneath it, compared lexically.
 *
 * Both arguments must already be identity keys (see
 * {@link FilesystemPathIdentity.key}). The function performs no filesystem
 * access and no case folding, which is what makes it cheap enough to call per
 * watcher event. A root that already ends in a separator (a volume root such as
 * `C:\` or `/`) is used as is, so every path on that volume is inside it.
 *
 * @param platform Separator semantics; defaults to the host platform.
 */
export function isFilesystemPathIdentityWithin(
  root: string,
  candidate: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (candidate === root) return true;
  const separator = platform === "win32" ? path.win32.sep : path.posix.sep;
  return candidate.startsWith(
    root.endsWith(separator) ? root : `${root}${separator}`,
  );
}
