import fs from "node:fs";
import path from "node:path";
import { parseJsonc, tsconfigExtendsFileCandidates } from "ttsc/tsconfig";

import { extendsSpecifiers } from "./extendsSpecifiers";
import { resolveExtendsConfig } from "./resolveExtendsConfig";
import { resolveRealPath } from "./resolveRealPath";

/**
 * Capture every config source independently of which option declares a value.
 *
 * Relative extends keeps the config's lexical anchor. Physical identity is used
 * only for branch-cycle detection; separate aliases can resolve different
 * bases. An unreadable or unparseable source has null content and cannot prove
 * a config.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Each source is read at its declared spelling, and relative bases resolve
 *   there like the compiler. A physical ancestor set terminates cycles while
 *   independent aliases retain their different relative-resolution contexts.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This traversal owns source observation and delegates extends grammar and
 *   resolution; the caller owns ordering and comparison of the resulting map.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Node resolve/readFile preserve the native lexical config anchor. Realpath
 *   is only a physical cycle observation; package resolution remains with the
 *   host resolver instead of reconstructing platform-dependent install paths.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Missing candidates retain explicit null observations rather than fabricated
 *   complete graph entries; no option-specific early stop drops unrelated bases.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain lexical anchoring, cycle identity and unavailable
 *   content, rather than presenting a null observation as successful parsing.
 */
export function collectTsconfigSourceSnapshot(
  tsconfig: string,
  seen: Set<string>,
  output: Map<string, string | null>,
): void {
  const resolved = path.resolve(tsconfig);
  if (output.has(resolved)) return;
  const canonical = resolveRealPath(resolved);
  if (seen.has(canonical)) return;
  const ancestors = new Set([...seen, canonical]);

  let contents: string;
  let parsed: { extends?: unknown };
  try {
    contents = fs.readFileSync(resolved, "utf8");
    output.set(resolved, contents);
    parsed = parseJsonc(contents) as typeof parsed;
  } catch {
    output.set(resolved, null);
    return;
  }
  if (typeof parsed !== "object" || parsed === null) return;

  for (const specifier of extendsSpecifiers(parsed.extends)) {
    const base = resolveExtendsConfig(resolved, specifier);
    if (base !== null) {
      collectTsconfigSourceSnapshot(base, ancestors, output);
      continue;
    }
    for (const candidate of tsconfigExtendsFileCandidates(
      resolved,
      specifier,
    ) ?? []) {
      if (!output.has(candidate)) output.set(candidate, null);
    }
  }
}
