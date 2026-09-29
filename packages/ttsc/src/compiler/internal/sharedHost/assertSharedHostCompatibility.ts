import type { ITtscLoadedNativePlugin } from "../../../structures/internal/ITtscLoadedNativePlugin";
import { isLinkedTransform } from "./isLinkedTransform";

/**
 * Verifies that all transform plugins in `plugins` either resolve to the same
 * native binary (the common case) after linked sources are removed from the
 * compiler-owner set.
 *
 * Two callers exist with subtly different error wording: the build path
 * (`runBuild`) reports "multiple compiler native backends cannot share one emit
 * pass" while the source-to-source path (`transformProjectInMemory.ts`) reports
 * "cannot share one source-to-source pass". The `pass` argument selects the
 * appropriate phrase so the error message remains diagnostic-grade instead of
 * generic.
 *
 * @evidence contracts/common.md#principled-implementation Only executable transform owners constrain a pass's binary; linked transform libraries execute inside that owner. Two different resolved owner paths cannot denote the one process this pass requires.
 * @evidence contracts/common.md#clear-and-simple-design One owner-path comparison handles both pass kinds, with diagnostic wording chosen only when a conflicting owner is encountered.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Compatibility follows loaded plugin stage and ownership discriminants, without special-casing plugin names or retrying an incompatible emit through another backend.
 * @evidence contracts/common.md#meaningful-documentation The comment states linked-library exclusion and explains the pass argument's diagnostic purpose in separate paragraphs following the documentation skill.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This predicate compares loader-provided owner identities without filesystem or process access; native binary resolution and identity normalization remain the loader's boundary.
 *
 * @evidence contracts/performance.md#efficient-algorithms One scan of P plugins compares executable owners with a single remembered path, requiring O(P) checks and constant auxiliary state instead of constructing two full binary sets.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each supplied plugin population belongs to its current pass; this predicate owns no stable cross-request producer identity or shared computation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The remembered owner is local to this check; no plugin table, descriptor or running host is retained.
 */
export function assertSharedHostCompatibility(
  plugins: readonly ITtscLoadedNativePlugin[],
  pass: "emit" | "source-to-source",
): void {
  let owner: string | undefined;
  for (const plugin of plugins) {
    if (isLinkedTransform(plugin)) continue;
    if (owner === undefined) {
      owner = plugin.binary;
      continue;
    }
    if (owner === plugin.binary) continue;
    const phrase =
      pass === "emit"
        ? "multiple compiler native backends cannot share one emit pass"
        : "multiple transform native backends cannot share one source-to-source pass";
    throw new Error(
      "ttsc: " +
        phrase +
        "; compose transform libraries through one aggregate native host",
    );
  }
}
