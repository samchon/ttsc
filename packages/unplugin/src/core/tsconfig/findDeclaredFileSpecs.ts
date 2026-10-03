import fs from "node:fs";
import path from "node:path";
import { parseJsonc, tsconfigExtendsFileCandidates } from "ttsc/tsconfig";

import { extendsSpecifiers } from "./extendsSpecifiers";
import { resolveExtendsConfig } from "./resolveExtendsConfig";
import { resolveRealPath } from "./resolveRealPath";

/**
 * Resolve an effective `files`, `include` or `exclude` list the way
 * TypeScript-Go merges them across `extends`.
 *
 * A config that declares the key owns it, whatever the value: an array is the
 * list, and `null` or any other value leaves the key unset while still hiding
 * every inherited list. A config that does not declare it takes the list of the
 * last `extends` entry that resolves to an array, so a later entry holding
 * `null` does not erase an earlier entry's list (`tsconfigparsing.go`,
 * `applyExtendedConfig`). `findDeclaredValue` stops at the first config that
 * supplies a selected declaration, whereas inherited non-arrays must not erase
 * an earlier array here, so this list is resolved on its own.
 *
 * `specs` drops non-string entries, as `validateSpecs` does. `rawSpecs` keeps
 * them for generated overlays that must preserve compiler diagnostics. The
 * declaring directory travels with the list because relative entries are
 * anchored there, in the spelling the config was named by, as
 * `findDeclaredValue` anchors every path (samchon/ttsc#1455).
 *
 * @returns The list and its declaring directory, `undefined` when no config in
 *   the chain supplies an array, or `null` when `tsconfig` itself cannot be
 *   read, which leaves the caller without any configuration to model.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Own key presence masks inherited lists even for invalid values; inherited
 *   arrays replace earlier bases in declaration order. Each list keeps its
 *   lexical declaring anchor and invalid elements do not become path specs.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This list-specific reader owns the null-versus-inherited-array rule that
 *   differs from ordinary nearest-value selection; readConfig owns input shape.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Relative specs retain the native declaring directory, while realpath only
 *   guards branch cycles. Host extends resolution and candidate APIs own native
 *   package and file naming; missing candidates retain their lexical paths.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The exception comes from compiler merge semantics, not a particular preset.
 *   Missing candidate inputs remain collected for future invalidation.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains own versus inherited null and the three return states;
 *   the distinction has a compiler basis and a documented consequence.
 * @evidence contracts/performance.md#efficient-algorithms
 *   The recursive search visits inherited branches until their last usable
 *   array is known. Resolution/parsing follows config occurrences and source
 *   bytes; copied ancestor sets cost the sum of depths, and array filtering
 *   and raw copying follow the winning and intermediate list lengths.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   An optional lexical-keyed configs map shares decoded and failed source
 *   observations within the caller's read transaction; selections and anchors
 *   remain branch-specific. Changed inputs require a new transaction map.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The ancestor set is local to the call; the collect and configs maps
 *   belong to the caller.
 */
export function findDeclaredFileSpecs(
  tsconfig: string,
  key: "files" | "include" | "exclude",
  collect?: Set<string>,
  /** Optional parsed-source map scoped to one caller-owned read transaction. */
  configs?: Map<string, unknown>,
):
  | { baseDir: string; specs: string[]; rawSpecs: readonly unknown[] }
  | undefined
  | null {
  const resolved = path.resolve(tsconfig);
  collect?.add(resolved);
  const parsed = readConfig(resolved, configs);
  if (parsed === undefined) return null;
  return resolve(
    resolved,
    parsed,
    key,
    new Set([resolveRealPath(resolved)]),
    collect,
    configs,
  );
}

function resolve(
  resolved: string,
  parsed: Record<string, unknown>,
  key: "files" | "include" | "exclude",
  seen: Set<string>,
  collect: Set<string> | undefined,
  configs: Map<string, unknown> | undefined,
):
  | { baseDir: string; specs: string[]; rawSpecs: readonly unknown[] }
  | undefined {
  if (Object.prototype.hasOwnProperty.call(parsed, key)) {
    const value = parsed[key];
    return Array.isArray(value)
      ? {
          baseDir: path.dirname(resolved),
          rawSpecs: value.slice(),
          specs: value.filter(
            (entry): entry is string => typeof entry === "string",
          ),
        }
      : undefined;
  }
  let inherited:
    | { baseDir: string; specs: string[]; rawSpecs: readonly unknown[] }
    | undefined;
  for (const specifier of extendsSpecifiers(parsed.extends)) {
    const base = resolveExtendsConfig(resolved, specifier);
    if (base === null) {
      // Record where the base would resolve, so a caller memoizing the policy
      // notices it appearing; see `findDeclaredValue`.
      for (const candidate of tsconfigExtendsFileCandidates(
        resolved,
        specifier,
      ) ?? []) {
        collect?.add(candidate);
      }
      continue;
    }
    collect?.add(base);
    const baseCanonical = resolveRealPath(base);
    if (seen.has(baseCanonical)) continue;
    const baseParsed = readConfig(base, configs);
    if (baseParsed === undefined) continue;
    const declared = resolve(
      base,
      baseParsed,
      key,
      new Set([...seen, baseCanonical]),
      collect,
      configs,
    );
    if (declared !== undefined) inherited = declared;
  }
  return inherited;
}

function readConfig(
  file: string,
  configs: Map<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  try {
    const parsed = configs?.has(file)
      ? configs.get(file)
      : parseJsonc(fs.readFileSync(file, "utf8"));
    configs?.set(file, parsed);
    return typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    configs?.set(file, undefined);
    return undefined;
  }
}
