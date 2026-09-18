import fs from "node:fs";
import path from "node:path";

import { extendsSpecifiers } from "./extendsSpecifiers";
import { isRelativeSpecifier } from "./isRelativeSpecifier";
import { missingExtendsCandidates } from "./missingExtendsCandidates";
import { normalizeTypeScriptPathSeparators } from "./normalizeTypeScriptPathSeparators";
import { parseJsonc } from "./parseJsonc";
import { resolveExtendsConfig } from "./resolveExtendsConfig";
import { resolveRealPath } from "./resolveRealPath";

/**
 * Find the nearest declaration of one config value along the `extends` chain,
 * with the directory of the config that declared it.
 *
 * TypeScript merges configs per key, so the effective value of a key is the
 * whole value from the nearest config that declares one: the config itself
 * first, then its `extends` entries in reverse priority order. The declaring
 * directory travels with the value because a path-valued option (`outDir`,
 * `exclude`) is anchored at the config that wrote it, not at the one that
 * inherited it.
 *
 * Best-effort by design, like `readEffectiveTsconfigPaths`: a missing or
 * unparsable config in the chain yields `null` here and a real config error
 * from the compiler, which owns config diagnostics.
 */
export function findDeclaredValue<T>(
  tsconfig: string,
  select: (parsed: object) => T | undefined,
  seen: Set<string>,
  /**
   * Every config this walk reads, accumulated across walks. Kept apart from
   * `seen`, which guards one walk against an `extends` cycle and must start
   * empty each time: sharing one set would make the second option's walk treat
   * the leaf as already visited and answer `null` for everything.
   */
  collect?: Set<string>,
): { baseDir: string; value: T } | null {
  const canonical = resolveRealPath(tsconfig);
  if (seen.has(canonical)) {
    return null;
  }
  seen.add(canonical);
  collect?.add(canonical);

  let parsed: { extends?: unknown };
  try {
    parsed = parseJsonc(fs.readFileSync(canonical, "utf8")) as typeof parsed;
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const own = select(parsed);
  if (own !== undefined) {
    return { baseDir: path.dirname(canonical), value: own };
  }

  for (const rawSpecifier of extendsSpecifiers(parsed.extends).reverse()) {
    const specifier = normalizeTypeScriptPathSeparators(rawSpecifier);
    const base = resolveExtendsConfig(canonical, specifier);
    if (base === null) {
      // Record where a relative or absolute specifier *would* have resolved,
      // even though nothing is there. A caller stamping this policy has to
      // notice the config appearing later, and a base config can be absent for
      // ordinary reasons: generated during install, or missing across a branch
      // switch. Without this the stamp never moves and a long-lived worker
      // keeps a policy the next run's walk already disagrees with. A bare
      // specifier is skipped, since it has no single candidate path.
      if (isRelativeSpecifier(specifier) || path.isAbsolute(specifier)) {
        for (const candidate of missingExtendsCandidates(
          canonical,
          specifier,
        )) {
          collect?.add(candidate);
        }
      }
      continue;
    }
    const declared = findDeclaredValue(base, select, seen, collect);
    if (declared !== null) {
      return declared;
    }
  }
  return null;
}
