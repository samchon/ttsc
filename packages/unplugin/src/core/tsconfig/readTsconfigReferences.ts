import fs from "node:fs";
import path from "node:path";

import { isFile } from "./isFile";
import { parseJsonc } from "./parseJsonc";

/**
 * The project configs a tsconfig's `references` name, in declaration order
 * (samchon/ttsc#1397).
 *
 * `references` is not inherited through `extends`, so only the config's own
 * list is read. A reference to a directory names that directory's
 * `tsconfig.json`, as `tsc -b` reads it; a reference to a file names the file.
 * An unreadable config or a malformed entry contributes nothing, since the
 * compiler owns the diagnostic for a broken solution.
 */
export function readTsconfigReferences(tsconfig: string): string[] {
  let parsed: unknown;
  try {
    parsed = parseJsonc(fs.readFileSync(tsconfig, "utf8"));
  } catch {
    return [];
  }
  const references = (parsed as { references?: unknown } | null)?.references;
  if (!Array.isArray(references)) return [];
  const directory = path.dirname(path.resolve(tsconfig));
  const output: string[] = [];
  for (const reference of references) {
    const target = (reference as { path?: unknown } | null)?.path;
    if (typeof target !== "string" || target.length === 0) continue;
    const resolved = path.resolve(directory, target);
    output.push(
      isFile(resolved) ? resolved : path.join(resolved, "tsconfig.json"),
    );
  }
  return output;
}
