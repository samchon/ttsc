import path from "node:path";

/**
 * Whether a path a plugin published as a project input can be watched on this
 * machine: absolute, free of NUL, and local.
 *
 * On Windows that admits drive paths, extended-length drive paths, and UNC
 * shares (including the `\\?\UNC\` form), and rejects device namespaces such as
 * `\\.\pipe\...`, which name no file a watcher could observe.
 *
 * @param platform Path rules to apply; defaults to the host platform.
 *
 * @evidence contracts/common.md#principled-implementation POSIX absolute syntax and explicit Windows drive/UNC recognizers distinguish watchable local path namespaces from relative and device namespaces; this is syntactic admission, not an existence check.
 * @evidence contracts/common.md#clear-and-simple-design Platform selection precedes Windows namespace recognition, with UNC volume validation kept in small private helpers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Namespace rules follow path syntax and do not whitelist projects or pretend device handles are ordinary files.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs name admitted Windows forms, rejected devices and the injectable platform parameter.
 * @evidence contracts/portability.md#os-neutral-implementation Explicit platform syntax uses path.posix or drive/UNC rules independent of the executing host; it does not infer existence, case policy or watcher support from the platform label.
 */
export function isAbsoluteLocalProjectInputPath(
  location: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (location.includes("\0")) return false;
  if (platform !== "win32") return path.posix.isAbsolute(location);
  const normalized = location.replaceAll("/", "\\");
  if (/^[A-Za-z]:\\/.test(normalized)) return true;
  if (normalized.startsWith("\\\\?\\")) {
    const extended = normalized.slice(4);
    if (/^[A-Za-z]:\\/.test(extended)) return true;
    if (extended.toLowerCase().startsWith("unc\\")) {
      return isWindowsUncProjectInputPath(`\\\\${extended.slice(4)}`);
    }
    return false;
  }
  if (normalized.startsWith("\\\\.\\")) return false;
  return isWindowsUncProjectInputPath(normalized);
}

function isWindowsUncProjectInputPath(location: string): boolean {
  const matched = /^\\\\([^\\]+)\\([^\\]+)(?:\\|$)/.exec(location);
  return (
    matched !== null &&
    isWindowsUncVolumeSegment(matched[1]!) &&
    isWindowsUncVolumeSegment(matched[2]!)
  );
}

function isWindowsUncVolumeSegment(segment: string): boolean {
  return segment !== "." && segment !== ".." && !/[\0<>:"/\\|?*]/.test(segment);
}
