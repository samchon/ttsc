import fs from "node:fs";
import path from "node:path";

import type { ITtscProjectIdentity } from "../../../structures/internal/ITtscProjectIdentity";
import type { ITtscProjectLocatorOptions } from "../../../structures/internal/ITtscProjectLocatorOptions";

/**
 * Resolve the selected config while retaining its lexical spelling separately
 * from the physical paths used by the TypeScript Program.
 *
 * The optional observer receives lexical selection candidates before their
 * existence checks, including missing nearer configs. This lets a reuse owner
 * detect later creation or symlink retargeting instead of watching only the
 * selected physical file.
 *
 * @evidence contracts/common.md#principled-implementation Explicit file/directory selection and nearest ancestor search preserve the actual lexical config path separately from physical Program identity; observations precede candidate checks so absence remains a selection premise.
 * @evidence contracts/common.md#clear-and-simple-design One selection operation returns both identities and forwards observations through a single callback without introducing its own caching or project policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Config names and precedence express the supported CLI contract; no consumer-specific paths or guessed physical-root equivalence replace actual filesystem selection.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains lexical/physical distinction and the observer's absent-candidate purpose, with paragraph and tag separation following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native resolve/dirname/join and realpath implement OS-neutral ancestor traversal and symlink identity; reaching a root is detected by parent equality rather than drive or slash parsing.
 * @evidence contracts/performance.md#efficient-algorithms Nearest-config discovery checks two candidates per visited ancestor and stops at the first match; explicit paths avoid ancestor traversal and physical identity uses only required realpath calls.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation reads current selection and owns no reusable cross-call result; its observer supplies premises to the actual cache owner.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources It retains only call-local path strings and acquires no open handle, task or historical state.
 */
export function resolveProjectIdentity(
  opts: ITtscProjectLocatorOptions = {},
  onInput?: (file: string) => void,
): Omit<ITtscProjectIdentity, "pluginConfigOrigin"> {
  const cwd = path.resolve(opts.cwd ?? process.cwd());
  const explicitProjectRoot =
    opts.projectRoot === undefined || opts.projectRoot === ""
      ? undefined
      : resolveAbsolutePath(cwd, opts.projectRoot);
  let logicalConfigPath: string;
  if (opts.tsconfig) {
    const resolved = resolveAbsolutePath(cwd, opts.tsconfig);
    onInput?.(resolved);
    if (!fs.existsSync(resolved)) {
      throw new Error(`ttsc: tsconfig not found: ${resolved}`);
    }
    // `-p <directory>` is the documented tsgo shorthand for the
    // directory that contains a `tsconfig.json`. Mirror that: without
    // this branch a forwarded `--tsconfig=sub` would feed the directory
    // path into `readResolvedCompilerOptions`, which calls
    // `fs.readFileSync` and throws `EISDIR`
    // (`test_ttsc_dash_p_directory_path_is_accepted` pins it).
    if (isDirectory(resolved)) {
      const tsconfigInDir = path.join(resolved, "tsconfig.json");
      onInput?.(tsconfigInDir);
      if (fs.existsSync(tsconfigInDir)) {
        logicalConfigPath = tsconfigInDir;
      } else {
        const jsconfigInDir = path.join(resolved, "jsconfig.json");
        onInput?.(jsconfigInDir);
        if (fs.existsSync(jsconfigInDir)) {
          logicalConfigPath = jsconfigInDir;
        } else {
          throw new Error(
            `ttsc: directory has no tsconfig.json / jsconfig.json: ${resolved}`,
          );
        }
      }
    } else {
      logicalConfigPath = resolved;
    }
  } else {
    const start = opts.file ? resolveAbsolutePath(cwd, opts.file) : cwd;
    const from = isDirectory(start) ? start : path.dirname(start);
    const found = findUp(from, ["tsconfig.json", "jsconfig.json"], onInput);
    if (!found) {
      throw new Error(
        `ttsc: could not find tsconfig.json or jsconfig.json starting from ${from}`,
      );
    }
    logicalConfigPath = found;
  }
  const physicalConfigPath = resolveRealPath(logicalConfigPath);
  const physicalProjectRoot = resolveRealPath(
    explicitProjectRoot ?? path.dirname(physicalConfigPath),
  );
  return {
    ...(explicitProjectRoot === undefined ? {} : { explicitProjectRoot }),
    invocationCwd: cwd,
    logicalConfigPath,
    logicalProjectRoot: path.dirname(logicalConfigPath),
    physicalConfigPath,
    physicalProjectRoot,
  };
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
function findUp(
  from: string,
  names: readonly string[],
  onInput?: (file: string) => void,
): string | null {
  let current = path.resolve(from);
  while (true) {
    for (const name of names) {
      const candidate = path.join(current, name);
      onInput?.(candidate);
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
