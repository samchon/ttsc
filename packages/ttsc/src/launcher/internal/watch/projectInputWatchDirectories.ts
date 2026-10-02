import { ProjectInputWatchRules } from "./ProjectInputWatchRules";

/**
 * Chooses the one stable recursive watcher root owned by a project-input
 * declaration.
 *
 * Inputs inside the project share its physical root so directory replacement
 * cannot strand a child handle. External inputs use the nearest existing
 * ancestor of their declared parent, which is the explicit boundary for
 * observing a currently missing external tree without polling every file --
 * except that the boundary never rises to a directory holding the project,
 * since such a root outranks the project's own in the active merge and leaves
 * one handle over a shared system directory to carry everything. An external
 * declaration that can only be owned that way falls back to its own tree, and
 * is left unwatched when even that would contain the project.
 *
 * @evidence contracts/common.md#principled-implementation The shared root selector preserves internal project coverage and the external ancestor ceiling; unavailable ownership remains an empty result.
 * @evidence contracts/common.md#clear-and-simple-design One delegation converts the optional owner into the caller's zero-or-one root list.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No second fallback broadens an absent safe owner into a system-wide watch.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain stable ownership, missing trees and unsafe external ancestors following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation The delegated selector owns native ancestry and actual physical containment instead of caller-side separator or OS-case assumptions.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources projectInputWatchDirectories declares a signature only; the implementation owns acquisition and release of resources.
 * @evidenceExclude contracts/performance.md#efficient-algorithms projectInputWatchDirectories declares a signature only; the implementation owns the processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work projectInputWatchDirectories declares a signature only; the implementation owns any shared work.
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
