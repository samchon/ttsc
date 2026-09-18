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
 */
export function projectInputWatchDirectories(
  target: string,
  projectRoot: string,
): string[] {
  const root = ProjectInputWatchRules.projectInputRecursiveWatchRoot(target, projectRoot);
  return root === undefined ? [] : [root];
}
