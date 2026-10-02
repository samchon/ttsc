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
 *
 * @evidence contracts/common.md#principled-implementation Native path resolution removes only recognized drive and UNC extended-length aliases; it normalizes lexical spelling without pretending to establish filesystem identity.
 * @evidence contracts/common.md#clear-and-simple-design One Windows normalization branch precedes the selected path API, keeping lexical syntax separate from physical realpath and case-policy decisions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Recognized Windows path prefixes are native syntax, not consumer exceptions; no filesystem method or global state is replaced.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains lexical scope, supported extended prefixes and the platform argument, separately from the acknowledgments.
 * @evidence contracts/portability.md#os-neutral-implementation Explicit win32 or posix path semantics handle native separators and Windows extended drive/UNC representations without assuming casing establishes physical identity.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Builds short local strings and retains nothing after returning.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A fixed number of string tests and one path.resolve call per invocation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A pure function of its two arguments; nothing is cached or shared.
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
