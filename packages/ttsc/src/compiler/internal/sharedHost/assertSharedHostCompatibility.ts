import type { ITtscLoadedNativePlugin } from "../../../structures/internal/ITtscLoadedNativePlugin";
import { isLinkedTransform } from "./isLinkedTransform";

/**
 * Requires equal loader-supplied binary strings for all entries other than
 * linked transform libraries. Compiler callers supply transform-stage subsets;
 * a linked check-stage entry is not excluded by this function.
 *
 * BuildExecution uses the emit diagnostic; in-memory and resident transform
 * setup use the source-to-source diagnostic. The pass argument selects that
 * wording. Equal strings here do not authenticate executable bytes or physical
 * equivalence of differently spelled paths.
 *
 * @evidence contracts/common.md#principled-implementation Linked transform libraries are excluded; every other supplied entry constrains the common binary string. Transform-stage filtering and physical executable identity remain caller/loader responsibilities.
 * @evidence contracts/common.md#clear-and-simple-design One owner-path comparison handles both pass kinds, with diagnostic wording chosen only when a conflicting owner is encountered.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Compatibility follows loaded plugin stage and ownership discriminants, without special-casing plugin names or retrying an incompatible emit through another backend.
 * @evidence contracts/common.md#meaningful-documentation The comment states linked-library exclusion and explains the pass argument's diagnostic purpose in separate paragraphs following the documentation skill.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This predicate compares loader-provided owner identities without filesystem or process access; native binary resolution and identity normalization remain the loader's boundary.
 *
 * @evidence contracts/performance.md#efficient-algorithms One scan performs up to P discriminant and binary-string comparisons with one remembered string reference. Work also depends on compared path lengths and conflict-message construction; no secondary population-sized sets are built.
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
