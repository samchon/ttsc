import fs from "node:fs";
import path from "node:path";

import { parseJsonc } from "ttsc/tsconfig";

import { normalizeTypeScriptPathSeparators } from "./normalizeTypeScriptPathSeparators";

/**
 * The project configs a tsconfig's `references` name, in declaration order
 * (samchon/ttsc#1397).
 *
 * `references` is not inherited through `extends`, so only the config's own
 * list is read. A reference is resolved by its spelling alone, as
 * TypeScript-Go's `ResolveConfigFileNameOfProjectReference` resolves it: a path
 * ending in `.json` names that file, and any other path names the
 * `tsconfig.json` inside it. The filesystem is never consulted, so a referenced
 * config that does not exist yet already has the spelling it will have, and a
 * watcher registered on it sees it appear. An unreadable config or a malformed
 * entry contributes nothing, since the compiler owns the diagnostic for a
 * broken solution.
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
    const resolved = path.resolve(
      directory,
      normalizeTypeScriptPathSeparators(target),
    );
    output.push(
      resolved.endsWith(".json")
        ? resolved
        : path.join(resolved, "tsconfig.json"),
    );
  }
  return output;
}
