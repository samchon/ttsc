import path from "node:path";
import { type ProjectInputPathIdentityContext } from "../../../internal/pathIdentity/ProjectInputPathIdentityContext";
import { createProjectInputPathIdentityContext } from "../../../internal/pathIdentity/createProjectInputPathIdentityContext";
import { WatchPaths } from "./WatchPaths";

/**
 * The directory to watch `location` through after some candidates failed.
 *
 * Starting at `location`, it escalates to the nearest existing parent while the
 * candidate is in `rejected` (a directory whose watcher already errored). It
 * never escalates to a directory that contains `projectRoot`, returning
 * `undefined` instead: losing the failed watcher is better than watching the
 * project from above.
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
