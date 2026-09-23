import fs from "node:fs";
import path from "node:path";
import { parseJsonc, tsconfigExtendsFileCandidates } from "ttsc/tsconfig";

import { extendsSpecifiers } from "./extendsSpecifiers";
import { resolveExtendsConfig } from "./resolveExtendsConfig";
import { resolveRealPath } from "./resolveRealPath";

/**
 * Resolve the effective `files` or `include` list of a tsconfig the way
 * TypeScript-Go merges them across `extends`.
 *
 * A config that declares the key owns it, whatever the value: an array is the
 * list, and `null` or any other value leaves the key unset while still hiding
 * every inherited list. A config that does not declare it takes the list of the
 * last `extends` entry that resolves to an array, so a later entry holding
 * `null` does not erase an earlier entry's list (`tsconfigparsing.go`,
 * `applyExtendedConfig`). `findDeclaredValue` stops at the first config that
 * has the key, which differs from that rule only for `null`, so this list is
 * resolved on its own.
 *
 * Non-string entries are dropped, as `validateSpecs` drops them. The declaring
 * directory travels with the list because relative entries are anchored there,
 * in the spelling the config was named by, as `findDeclaredValue` anchors every
 * path (samchon/ttsc#1455).
 *
 * @returns The list and its declaring directory, `undefined` when no config in
 *   the chain supplies an array, or `null` when `tsconfig` itself cannot be
 *   read, which leaves the caller without any configuration to model.
 */
export function findDeclaredFileSpecs(
  tsconfig: string,
  key: "files" | "include",
  collect?: Set<string>,
): { baseDir: string; specs: string[] } | undefined | null {
  const resolved = path.resolve(tsconfig);
  collect?.add(resolved);
  const parsed = readConfig(resolved);
  if (parsed === undefined) return null;
  return resolve(
    resolved,
    parsed,
    key,
    new Set([resolveRealPath(resolved)]),
    collect,
  );
}

function resolve(
  resolved: string,
  parsed: Record<string, unknown>,
  key: "files" | "include",
  seen: Set<string>,
  collect: Set<string> | undefined,
): { baseDir: string; specs: string[] } | undefined {
  if (Object.prototype.hasOwnProperty.call(parsed, key)) {
    const value = parsed[key];
    return Array.isArray(value)
      ? {
          baseDir: path.dirname(resolved),
          specs: value.filter(
            (entry): entry is string => typeof entry === "string",
          ),
        }
      : undefined;
  }
  let inherited: { baseDir: string; specs: string[] } | undefined;
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
    const baseParsed = readConfig(base);
    if (baseParsed === undefined) continue;
    const declared = resolve(
      base,
      baseParsed,
      key,
      new Set([...seen, baseCanonical]),
      collect,
    );
    if (declared !== undefined) inherited = declared;
  }
  return inherited;
}

function readConfig(file: string): Record<string, unknown> | undefined {
  try {
    const parsed = parseJsonc(fs.readFileSync(file, "utf8"));
    return typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}
