import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveSourceBuildCachePaths } from "./source/resolveSourceBuildCachePaths";

/**
 * The on-disk format of the capability-resolution cache, shared by its reader
 * and writer so both agree on the entry's location, version tag, and the
 * fingerprint that proves an entry still describes the project.
 */
export namespace CapabilityResolutionFormat {
/**
 * Cache format tag.
 *
 * Moves when the entry shape or the validation rule changes, so an older entry
 * is discarded rather than read under new rules.
 */
const FORMAT = "ttsc-capability-resolution-v1";

/**
 * The character that joins fields a path could otherwise forge.
 *
 * A path cannot contain it, which is the whole reason it is the separator: with
 * a space, a file named `a 1 2` states the same string as a one-byte file named
 * `a`, and an edit to either would read as no edit at all. Built rather than
 * written literally, because a source file carrying a raw NUL is one Git
 * classifies as binary — which silently exempts it from this repository's
 * end-of-line contract and leaves it with no textual diff for a reviewer.
 */
const SEPARATOR = String.fromCharCode(0);

/**
 * The version string an entry records: the format tag joined with the ttsc
 * version, so a ttsc upgrade invalidates every entry written by another one.
 */
export function formatVersion(version: string): string {
  return `${FORMAT}:${version}`;
}

/**
 * Where the entry for this project lives, or `null` when no cache root can be
 * resolved.
 *
 * Keyed on the project rather than on the capability: the walk it replaces
 * discovers every configured plugin, so one entry answers for all of them and a
 * second consumer asking about a different capability costs nothing.
 */
export function resolutionFile(options: {
  cwd: string;
  tsconfig: string;
  env?: NodeJS.ProcessEnv;
}): string | null {
  let root: string;
  try {
    root = resolveSourceBuildCachePaths(
      path.resolve(options.cwd),
      undefined,
      options.env ?? process.env,
    ).root;
  } catch {
    return null;
  }
  const key = crypto
    .createHash("sha256")
    .update(path.resolve(options.cwd))
    .update(SEPARATOR)
    .update(options.tsconfig)
    .digest("hex");
  return path.join(root, "capabilities", `${key}.json`);
}

/**
 * A directory's shape and the state of every file in it.
 *
 * Size and modification time rather than content: a plugin's Go source is
 * hundreds of files, this runs on the fast path, and the question it answers is
 * only whether the build cache would now key on something else. Bounded in
 * depth, and blind to `node_modules` and dot directories, for the same reason
 * the build that reads this source is.
 */
export function fingerprintDirectory(directory: string, depth = 0): string {
  const hash = crypto.createHash("sha256");
  for (const line of directoryState(directory, depth).sort())
    hash.update(line).update("\n");
  return hash.digest("hex");
}

function directoryState(directory: string, depth: number): string[] {
  if (depth > 16) return [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return [`${directory}${SEPARATOR}absent`];
  }
  const states: string[] = [];
  for (const entry of entries) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      states.push(...directoryState(child, depth + 1));
      continue;
    }
    try {
      const stat = fs.statSync(child);
      states.push(
        [child, String(stat.size), String(stat.mtimeMs)].join(SEPARATOR),
      );
    } catch {
      states.push(`${child}${SEPARATOR}absent`);
    }
  }
  return states;
}
}
