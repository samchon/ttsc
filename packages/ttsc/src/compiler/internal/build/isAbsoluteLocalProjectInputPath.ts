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
