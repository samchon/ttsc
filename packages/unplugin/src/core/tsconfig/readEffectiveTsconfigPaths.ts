import path from "node:path";

import { absolutizePathsTarget } from "./absolutizePathsTarget";
import { findDeclaredPaths } from "./findDeclaredPaths";

/**
 * Read the effective `compilerOptions.paths` of a tsconfig, following its
 * `extends` chain, and absolutize every mapping target.
 *
 * TypeScript merges `compilerOptions` per option key, so the effective `paths`
 * is the whole object from the nearest config in the chain that declares one
 * (own config first, then `extends` entries in reverse priority order).
 * Relative targets are anchored at the directory of the config that declares
 * them. TypeScript-Go resolves inherited relative `paths` against the declaring
 * file, not the extending one.
 *
 * The generated transform tsconfig replaces `paths` wholesale (standard
 * `extends` semantics), so the alias overlay must re-state these base mappings
 * or every tsconfig-only alias silently stops resolving. Absolutizing is
 * required because the generated config lives in a system temp directory and
 * TypeScript-Go rejects non-relative targets (TS5090) while accepting absolute
 * ones.
 *
 * Best-effort by design: a missing or unparsable config in the chain yields
 * `{}` here and a real config error from the compiler, which owns config
 * diagnostics.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Effective paths replace the whole inherited option; each string target
 *   becomes absolute at the declaring directory so wrapper relocation preserves
 *   its resolution meaning. Invalid target entries are not emitted as paths.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Declaration lookup, target anchoring and output assembly have separate
 *   helpers; this reader owns the wrapper's complete inherited alias overlay.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Targets resolve with native anchors and become forward-slash config
 *   patterns; that representation conversion does not define filesystem identity.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The overlay preserves declared aliases rather than synthesizing aliases
 *   for a known application; config diagnostics remain with the compiler.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Paragraphs explain wholesale replacement and temporary-wrapper anchoring,
 *   including the reason an absolute mapping is necessary instead of optional.
 */
export function readEffectiveTsconfigPaths(
  tsconfig: string,
): Record<string, string[]> {
  const resolved = path.resolve(tsconfig);
  const declared = findDeclaredPaths(resolved, new Set());
  if (declared === null) {
    return {};
  }
  const output: Record<string, string[]> = {};
  for (const [key, targets] of Object.entries(declared.paths)) {
    if (!Array.isArray(targets)) {
      continue;
    }
    const absolute = targets
      .filter((target): target is string => typeof target === "string")
      .map((target) =>
        absolutizePathsTarget(declared.baseDir, target, path.dirname(resolved)),
      );
    if (absolute.length !== 0) {
      output[key] = absolute;
    }
  }
  return output;
}
