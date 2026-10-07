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
 * The admitted set narrows which named events lead a watch session to re-read
 * and re-hash its declared corpus, and both directions cost: too narrow drops
 * an atomic replacement, too wide re-fingerprints on every entry an install
 * creates. Exported so that boundary is pinned directly instead of being
 * inferred from a rebuild that a silent rescan and a skipped rescan produce
 * identically.
 *
 * @evidence contracts/common.md#principled-implementation Declaration ancestry, reload territories and admitted glob trees decide whether an unnamed input may have moved, covering replacement events named after an arriving sibling.
 * @evidence contracts/common.md#clear-and-simple-design A shared declaration-anchor predicate separates replacement ancestry from reload and glob admission.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Admission follows published declarations rather than hardcoded node_modules exclusion or unconditional whole-project rescanning.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain lost replacements and unnecessary corpus scans with their reasons, following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native path operations and transaction-owned physical containment qualify event paths and glob roots with actual case semantics.
 * @evidence contracts/performance.md#efficient-algorithms Up to two anchor checks visit file/reload/glob declarations before reload-directory and G glob branches; each glob can scan P borrowed previous members. Native directory stat and delegated identity/ancestor/case observations plus literal-root/path/key text are additional costs. Short-circuiting can stop earlier; populations/text are uncapped and this predicate does not read or hash corpus contents.
 * @evidence contracts/performance.md#reuse-equivalent-work The caller can share one identity transaction with event matching and later classification; repeated resolutions within this decision use that transaction's cache.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No watcher, historical event population or resident cache is acquired by this admission predicate.
 */
export function projectInputTopologyMayAffect(
  snapshot: ITtscProjectInputSnapshot,
  location: string,
  previous: ReadonlyMap<string, string>,
  identities = createProjectInputPathIdentityContext(),
): boolean {
  const changed = path.resolve(location);
  const anchors = (directory: string): boolean =>
    ProjectInputWatchRules.projectInputAnchorsDeclaration(
      snapshot,
      directory,
      identities,
    );
  // An atomic replacement can name an ancestor or arriving sibling rather than
  // the declared file whose bytes moved. That directory can be one the
  // declaration does not contain: renaming `docs` away can report the arriving
  // `docs-old`, not `docs`. So a directory event is admitted from where it
  // happened rather than from what it contains: its own parent must already lie
  // on the path to a declared input. A tree no declaration reaches, such as
  // `node_modules` under an ordinary project, avoids corpus rescanning for each
  // created entry while still paying this admission predicate cost. A
  // glob whose literal root covers that tree still admits every directory
  // beneath it through the branch below, because a directory appearing inside a
  // glob root can hold matches; the declaration decides that reach, not this
  // rule.
  if (WatchPaths.isDirectory(changed) && anchors(path.dirname(changed)))
    return true;
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
      for (const input of previous.values()) {
        if (identities.isWithin(changed, input)) return true;
      }
      return false;
    })
  );
}
