import fs from "node:fs";
import path from "node:path";

import type { ITtscProjectLocatorOptions } from "../../../structures/internal/ITtscProjectLocatorOptions";

/**
 * Resolve the tsconfig/jsconfig that owns a ttsc invocation.
 *
 * Resolution order:
 *
 * 1. `opts.tsconfig` — resolved absolute and checked for existence.
 * 2. `opts.file` — the nearest ancestor config that contains the file is found by
 *    walking up from the file's directory.
 * 3. `opts.cwd` — the nearest ancestor config walking up from cwd.
 *
 * Always returns a real (symlink-resolved) absolute path. Throws when no config
 * is found or the explicitly supplied path does not exist.
 */
export function resolveProjectConfig(
  opts: ITtscProjectLocatorOptions = {},
): string {
  const cwd = path.resolve(opts.cwd ?? process.cwd());
  if (opts.tsconfig) {
    const resolved = resolveAbsolutePath(cwd, opts.tsconfig);
    if (!fs.existsSync(resolved)) {
      throw new Error(`ttsc: tsconfig not found: ${resolved}`);
    }
    // `-p <directory>` is the documented tsgo shorthand for the
    // directory that contains a `tsconfig.json`. Mirror that — without
    // this branch a forwarded `--tsconfig=sub` would feed the directory
    // path into `readResolvedCompilerOptions`, which calls
    // `fs.readFileSync` and throws `EISDIR` (the RCA's predicted
    // RC-3 §5 #2 bug, pinned by
    // `test_ttsc_dash_p_directory_path_is_accepted`).
    if (isDirectory(resolved)) {
      const tsconfigInDir = path.join(resolved, "tsconfig.json");
      if (fs.existsSync(tsconfigInDir)) {
        return resolveRealPath(tsconfigInDir);
      }
      const jsconfigInDir = path.join(resolved, "jsconfig.json");
      if (fs.existsSync(jsconfigInDir)) {
        return resolveRealPath(jsconfigInDir);
      }
      throw new Error(
        `ttsc: directory has no tsconfig.json / jsconfig.json: ${resolved}`,
      );
    }
    return resolveRealPath(resolved);
  }

  const start = opts.file
    ? resolveRealPath(resolveAbsolutePath(cwd, opts.file))
    : cwd;
  const from = isDirectory(start) ? start : path.dirname(start);
  const found = findUp(from, ["tsconfig.json", "jsconfig.json"]);
  if (!found) {
    throw new Error(
      `ttsc: could not find tsconfig.json or jsconfig.json starting from ${from}`,
    );
  }
  return resolveRealPath(found);
}

/** Resolve `target` against `cwd` when it is not already absolute. */
function resolveAbsolutePath(cwd: string, target: string): string {
  return path.isAbsolute(target) ? target : path.resolve(cwd, target);
}

/**
 * Resolve symlinks on `location`, returning the original path when
 * `realpathSync` fails (e.g. when the file does not yet exist).
 */
function resolveRealPath(location: string): string {
  try {
    return fs.realpathSync(location);
  } catch {
    return location;
  }
}

/**
 * Walk up the directory tree from `from`, returning the first directory that
 * contains a file whose name is in `names`. Returns `null` when the filesystem
 * root is reached without finding a match.
 */
function findUp(from: string, names: readonly string[]): string | null {
  let current = path.resolve(from);
  while (true) {
    for (const name of names) {
      const candidate = path.join(current, name);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

/** Return true when `location` exists and is a directory. */
function isDirectory(location: string): boolean {
  try {
    return fs.statSync(location).isDirectory();
  } catch {
    return false;
  }
}
