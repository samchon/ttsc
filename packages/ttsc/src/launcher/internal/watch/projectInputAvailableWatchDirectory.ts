import path from "node:path";

import { type ProjectInputPathIdentityContext } from "../../../internal/pathIdentity/ProjectInputPathIdentityContext";
import { createProjectInputPathIdentityContext } from "../../../internal/pathIdentity/createProjectInputPathIdentityContext";
import { WatchPaths } from "./WatchPaths";

/**
 * The directory to watch `location` through after some candidates failed.
 *
 * Starting at `location`, it escalates to the nearest existing parent while the
 * candidate is in `rejected` (a directory whose watcher already errored). It
 * refuses a candidate strictly containing `projectRoot`, returning `undefined`
 * instead; equal project identity remains admissible. Losing the failed root is
 * preferred to selecting the project from above. This selector installs no
 * watcher and does not establish native event delivery.
 *
 * @evidence contracts/common.md#principled-implementation Rejected roots climb existing ancestors within the same project-containment ceiling as initial selection, preserving the distinction between unavailable coverage and unsafe broadening.
 * @evidence contracts/common.md#clear-and-simple-design One ancestor loop combines rejection membership, existing-directory discovery and a shared identity policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Recovery refuses strictly containing roots rather than treating any available ancestor as a safe candidate; project identity itself remains eligible.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain rejection, escalation and the undefined result following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native ancestry uses path.dirname and the transaction resolver compares actual physical identities rather than an OS-derived case rule.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The helper acquires no watcher or historical state. Borrowed rejection/context state remains caller-owned; a default context becomes reclaimable when invocation references are discarded, and the returned path transfers to the caller.
 * @evidence contracts/performance.md#efficient-algorithms Rejected candidates climb native lexical ancestors; fallback directory searches perform stat admission, and identity/containment adds realpath, ancestor, entry and possible case-query work. Depth/path/key text and observation populations are uncapped; no descendant corpus is enumerated. The initial candidate is assumed selected by the caller rather than independently checked for directory kind here.
 * @evidence contracts/performance.md#reuse-equivalent-work A supplied transaction shares repeated identity/case observations across candidate and project-ceiling queries; an omitted context starts invocation-local observations. Native fallback stat admission is fresh and not memoized by this helper.
 */
export function projectInputAvailableWatchDirectory(
  location: string,
  rejected: ReadonlySet<string>,
  identities: ProjectInputPathIdentityContext = createProjectInputPathIdentityContext(),
  projectRoot?: string,
): string | undefined {
  const resolvedProjectRoot =
    projectRoot === undefined ? undefined : path.resolve(projectRoot);
  let current = path.resolve(location);
  while (true) {
    const identity = identities.resolve(current);
    // Escalation obeys the same ceiling root selection does. A watcher that
    // failed once would otherwise be replaced by one over a directory holding
    // the project, which outranks the project's own root in the active merge
    // and re-opens, through the recovery path, the exact swallow that selection
    // refuses to create. Giving up the failed root is the lesser loss.
    if (
      resolvedProjectRoot !== undefined &&
      identity.key !== identities.resolve(resolvedProjectRoot).key &&
      identities.isWithin(identity.path, resolvedProjectRoot)
    ) {
      return undefined;
    }
    if (!rejected.has(identity.key)) return identity.path;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    const fallback = WatchPaths.nearestExistingDirectory(parent);
    if (fallback === undefined) return undefined;
    current = fallback;
  }
}
