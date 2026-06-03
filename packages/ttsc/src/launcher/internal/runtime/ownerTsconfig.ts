import fs from "node:fs";
import path from "node:path";

/**
 * Resolve the tsconfig.json that owns a source file: the nearest one walking up
 * from the file's directory. This is the project whose compiler options and
 * plugins the file must be emitted under, so a dependency served as raw `.ts`
 * compiles with its own package's settings rather than a foreign project's.
 *
 * Results are memoized per directory because the loader asks repeatedly for
 * files in the same project. Returns null when no tsconfig.json exists above the
 * file (the caller falls back to the entry's tsconfig).
 */
const cache = new Map<string, string | null>();

export function resolveOwnerTsconfig(file: string): string | null {
  return resolveFromDir(path.dirname(file));
}

function resolveFromDir(dir: string): string | null {
  const cached = cache.get(dir);
  if (cached !== undefined) {
    return cached;
  }
  const candidate = path.join(dir, "tsconfig.json");
  let owner: string | null;
  if (fs.existsSync(candidate)) {
    owner = candidate;
  } else {
    const parent = path.dirname(dir);
    owner = parent === dir ? null : resolveFromDir(parent);
  }
  cache.set(dir, owner);
  return owner;
}
