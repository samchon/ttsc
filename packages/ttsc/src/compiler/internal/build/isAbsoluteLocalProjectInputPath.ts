import path from "node:path";

/**
 * Whether a published project-input spelling fits the selected native absolute
 * filesystem namespace: free of NUL and, on Windows, outside device namespaces.
 * This does not establish existence, access or actual watcher support. UNC
 * shares may denote network storage; local here means native path syntax, not a
 * URL.
 *
 * On Windows that admits drive paths, extended-length drive paths, and UNC
 * shares (including the `\\?\UNC\` form), and rejects device namespaces such as
 * `\\.\pipe\...`, which name no file a watcher could observe.
 *
 * @param platform Path rules to apply; defaults to the host platform.
 * @evidence contracts/common.md#principled-implementation POSIX absolute syntax and explicit Windows drive/UNC recognizers distinguish syntactically admissible native paths from relative and Windows device namespaces; this is not an existence, file-kind or watch-capability check.
 * @evidence contracts/common.md#clear-and-simple-design Platform selection precedes Windows namespace recognition, with UNC volume validation kept in small private helpers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Namespace rules follow path syntax and do not whitelist projects or pretend device handles are ordinary files.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs name admitted Windows forms, rejected devices and the injectable platform parameter.
 * @evidence contracts/portability.md#os-neutral-implementation Explicit platform syntax uses path.posix or drive/UNC rules independent of the executing host; it does not infer existence, case policy or watcher support from the platform label.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Normalized/sliced path strings are temporary and can scale with the supplied spelling; no path history, descriptor or task is retained after return.
 * @evidence contracts/performance.md#efficient-algorithms NUL detection scans input text; Windows additionally replaces separators and can slice/lowercase extended text before drive/UNC and volume-segment regex checks. Work and temporary strings scale with path bytes, with short-circuit branches avoiding later checks; no native I/O is performed.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This call-local namespace classifier coordinates no retained or in-flight producer; native identity or watch-capability reuse belongs to its callers.
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
