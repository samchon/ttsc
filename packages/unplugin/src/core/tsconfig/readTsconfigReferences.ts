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
 * `tsconfig.json` inside it. Reference-target existence is never probed, so a
 * referenced config that does not exist yet already has the spelling it will
 * have, and a watcher registered on it sees it appear. An unreadable config or
 * a malformed entry contributes nothing, since the compiler owns the diagnostic
 * for a broken solution.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Only the config's own references are read. String paths preserve declaration
 *   order; json suffix versus directory spelling follows compiler naming rules,
 *   so missing targets retain stable candidate addresses for watchers.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This reader owns reference extraction and address mapping; project routing
 *   and cycle detection remain with the operations that consume the list.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Config separators normalize before Node native resolution. The json suffix
 *   follows compiler syntax; absent references retain native absolute paths
 *   without shell text or inferred filesystem case policy.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Unreadable configuration supplies no invented references, and existence
 *   probes cannot erase a target whose later appearance changes selection.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain non-inheritance, suffix naming and missing-target
 *   watchability, separating path spelling from actual filesystem membership.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Reads/parses the source config once and visits its N references in order.
 *   Config bytes, native source lookup and accepted target/anchor spelling
 *   lengths drive work and temporary strings; no target existence scan occurs.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   This single-source extraction coordinates no cross-call work. Selection
 *   entries own validated reuse and retain the returned reference list.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
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
