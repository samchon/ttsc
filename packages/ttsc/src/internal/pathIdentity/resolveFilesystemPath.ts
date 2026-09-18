import path from "node:path";

/**
 * Normalize a path lexically, without touching the filesystem.
 *
 * On Windows, forward slashes become backslashes and the extended-length
 * prefixes a native API can return (`\\?\C:\...` and `\\?\UNC\server\share`)
 * are removed, so one location spelled by Node, by `fs.realpathSync.native`,
 * and by a user compares equal before any identity is taken. POSIX paths are
 * only resolved.
 *
 * @param platform Path semantics; defaults to the host platform.
 */
export function resolveFilesystemPath(
  location: string,
  platform: NodeJS.Platform = process.platform,
): string {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  if (platform !== "win32") {
    return pathApi.resolve(location);
  }
  const normalized = location.replaceAll("/", "\\");
  if (normalized.toLowerCase().startsWith("\\\\?\\unc\\")) {
    return pathApi.resolve(`\\\\${normalized.slice(8)}`);
  }
  if (
    normalized.startsWith("\\\\?\\") &&
    /^[A-Za-z]:\\/.test(normalized.slice(4))
  ) {
    return pathApi.resolve(normalized.slice(4));
  }
  return pathApi.resolve(normalized);
}
