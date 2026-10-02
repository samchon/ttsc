import { ProjectInputWatchRules } from "./ProjectInputWatchRules";

/**
 * Return the selected zero-or-one recursive root for a project-input declaration.
 *
 * The shared selector uses the project's nearest existing ancestry for internal
 * inputs. External inputs prefer the declared parent's existing ancestry, then
 * the target's own, excluding strict ancestors of the project but admitting
 * equal physical identity. An unavailable selected root becomes an empty list.
 * This adapter neither installs a watch nor proves delivery after replacement;
 * the topology caller owns observation and reporting of uncovered declarations.
 *
 * @evidence contracts/common.md#principled-implementation The shared selector preserves the internal-root and external strict-ancestor selection policy; an unavailable owner remains an empty result rather than proof of watch coverage.
 * @evidence contracts/common.md#clear-and-simple-design One delegation converts the optional owner into the caller's zero-or-one root list.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No second fallback broadens an absent safe owner into a system-wide watch.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish current root selection, equal versus strict ancestry and caller-owned native observation following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation The delegated selector owns native ancestry and actual physical containment instead of caller-side separator or OS-case assumptions.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The adapter returns a caller-owned list of at most one spelling and starts no watcher or retained observer. The selector's default identity maps are invocation-local; their query population is not bounded by this small result.
 * @evidence contracts/performance.md#efficient-algorithms The zero-or-one list conversion is fixed-width, but its delegated selector performs identity/path work and one internal or two external native ancestor-stat searches, including possible case queries. No descendant corpus is enumerated and declaration path depth/text is not capped here.
 * @evidence contracts/performance.md#reuse-equivalent-work The delegated selector shares its new context's per-key observations within one selection. Each adapter invocation creates a fresh context, so repeated declarations may repeat native observations; this adapter coordinates no cross-invocation answer reuse or watcher ownership.
 */
export function projectInputWatchDirectories(
  target: string,
  projectRoot: string,
): string[] {
  const root = ProjectInputWatchRules.projectInputRecursiveWatchRoot(
    target,
    projectRoot,
  );
  return root === undefined ? [] : [root];
}
