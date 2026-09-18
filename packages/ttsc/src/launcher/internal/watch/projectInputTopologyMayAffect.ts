import path from "node:path";
import { createProjectInputPathIdentityContext } from "../../../internal/pathIdentity/createProjectInputPathIdentityContext";
import type { ITtscProjectInputSnapshot } from "../../../structures/internal/ITtscProjectInputSnapshot";
import { ProjectInputWatchRules } from "./ProjectInputWatchRules";
import { WatchPaths } from "./WatchPaths";
import { literalGlobRoot } from "./literalGlobRoot";

/**
 * Decide whether an event that named no declared input can still have moved
 * one.
 *
 * The admitted set is the only bound on how often a watch session re-reads and
 * re-hashes its declared corpus, and both directions cost: too narrow drops an
 * atomic replacement, too wide re-fingerprints on every entry an install
 * creates. Exported so that boundary is pinned directly instead of being
 * inferred from a rebuild that a silent rescan and a skipped rescan produce
 * identically.
 */
export function projectInputTopologyMayAffect(
  snapshot: ITtscProjectInputSnapshot,
  location: string,
  previous: ReadonlyMap<string, string>,
  identities = createProjectInputPathIdentityContext(),
): boolean {
  const changed = path.resolve(location);
  const anchors = (directory: string): boolean =>
    ProjectInputWatchRules.projectInputAnchorsDeclaration(snapshot, directory, identities);
  // An atomic replacement never names the declared file whose bytes it changed;
  // it names the directory that was swapped, and that directory can be one the
  // declaration does not contain — renaming `docs` away reports the arriving
  // `docs-old`, not `docs`. So a directory event is admitted from where it
  // happened rather than from what it contains: its own parent must already lie
  // on the path to a declared input. A tree no declaration reaches, such as
  // `node_modules` under an ordinary project, then costs nothing per created
  // entry instead of a population rescan and a full content re-fingerprint. A
  // glob whose literal root covers that tree still admits every directory
  // beneath it through the branch below, because a directory appearing inside a
  // glob root can hold matches; the declaration decides that reach, not this
  // rule.
  if (WatchPaths.isDirectory(changed) && anchors(path.dirname(changed))) return true;
  return (
    anchors(changed) ||
    (snapshot.reloadDirectories ?? []).some((directory) =>
      identities.isWithin(directory, changed),
    ) ||
    snapshot.globs.some((glob) => {
      const root = literalGlobRoot(glob);
      if (identities.isWithin(changed, root)) return true;
      if (identities.isWithin(root, changed) === false) return false;
      if (WatchPaths.isDirectory(changed)) return true;
      return [...previous.values()].some((input) =>
        identities.isWithin(changed, input),
      );
    })
  );
}
