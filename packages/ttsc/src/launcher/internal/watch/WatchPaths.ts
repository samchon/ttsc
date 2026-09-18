import fs from "node:fs";
import path from "node:path";

/**
 * Cheap, lexical path helpers the watch topology calls per event.
 *
 * They deliberately avoid the filesystem-identity resolver: watcher events
 * arrive in bursts and these questions (is this under that, are these two maps
 * equal) only need the spelling the topology already normalized.
 */
export namespace WatchPaths {
/** Whether `location` exists and is a directory, following links. */
export function isDirectory(location: string): boolean {
  try {
    return fs.statSync(location).isDirectory();
  } catch {
    return false;
  }
}

/**
 * The closest existing directory at or above `location`, or `undefined` when
 * not even the volume root exists. Watching a missing input starts here.
 */
export function nearestExistingDirectory(location: string): string | undefined {
  let current = path.resolve(location);
  while (true) {
    if (isDirectory(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

/** Whether two key-to-path maps hold exactly the same entries. */
export function mapsEqual(
  left: ReadonlyMap<string, string>,
  right: ReadonlyMap<string, string>,
): boolean {
  if (left.size !== right.size) return false;
  return [...left].every(([key, value]) => right.get(key) === value);
}

/** Whether `candidate` is `root` or lies beneath it, compared lexically. */
export function isPathWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (relative !== ".." &&
      relative.startsWith(`..${path.sep}`) === false &&
      !path.isAbsolute(relative))
  );
}

/** The host platform's lexical watch key for `location`. */
export function pathKey(location: string): string {
  return pathKeyForPlatform(location, process.platform);
}

/**
 * A lexical watch key: the resolved path, lower-cased on Windows where the
 * watcher backends report the case the user typed rather than the case on disk.
 */
export function pathKeyForPlatform(
  location: string,
  platform: NodeJS.Platform,
): string {
  const resolved = path.resolve(location);
  return platform === "win32" ? resolved.toLowerCase() : resolved;
}
}
