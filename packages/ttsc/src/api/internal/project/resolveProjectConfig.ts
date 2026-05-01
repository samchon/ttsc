import * as fs from "node:fs";
import * as path from "node:path";

import type { ITtscProjectLocatorOptions } from "../../../structures/internal/ITtscProjectLocatorOptions";

/** Resolve the tsconfig/jsconfig that owns a ttsc invocation. */
export function resolveProjectConfig(
  opts: ITtscProjectLocatorOptions = {},
): string {
  const cwd = path.resolve(opts.cwd ?? process.cwd());
  if (opts.tsconfig) {
    const resolved = resolveAbsolutePath(cwd, opts.tsconfig);
    if (!fs.existsSync(resolved)) {
      throw new Error(`ttsc: tsconfig not found: ${resolved}`);
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

function resolveAbsolutePath(cwd: string, target: string): string {
  return path.isAbsolute(target) ? target : path.resolve(cwd, target);
}

function resolveRealPath(location: string): string {
  try {
    return fs.realpathSync(location);
  } catch {
    return location;
  }
}

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

function isDirectory(location: string): boolean {
  try {
    return fs.statSync(location).isDirectory();
  } catch {
    return false;
  }
}
