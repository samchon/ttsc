import path from "node:path";

import type { ProjectInputPathIdentityContext } from "../../../internal/pathIdentity/ProjectInputPathIdentityContext";
import { createProjectInputPathIdentityContext } from "../../../internal/pathIdentity/createProjectInputPathIdentityContext";
import type { CompilerDirectoryWatchEventPlan } from "./CompilerDirectoryWatchEventPlan";
import { ProjectInputWatchRules } from "./ProjectInputWatchRules";

/**
 * Plan one compiler-directory event without relying on backend timing.
 *
 * A named content change of a tracked file is a candidate on every platform. On
 * POSIX the file has a watcher of its own too, and either can miss what the
 * other hears: on macOS a directory watch has heard a config edit its file
 * watch never delivered. Both are decided from the bytes
 * (`WatchTopology.compilerChangesToReport`), so the first to see the edit
 * reports it once. A named rename selects the surviving file for rearming; an
 * unnamed event conservatively selects every surviving tracked input below the
 * watch root as a change candidate and for non-Windows rearming. The caller
 * verifies actual content/owner movement before reporting; an event alone does
 * not prove inode replacement. Windows has no per-file watchers here. A named
 * event for an untracked path refreshes membership only when that path could
 * move it (namedEventMayMoveMembership); a write the compiler never reads costs
 * no listing.
 *
 * Native case observations belong to `identities`, shared with the caller's
 * reconciliation or created fresh here. An exact indexed member is preferred; a
 * missing key conservatively routes eligible lexical aliases without merging
 * stored members. `platform` controls rearming, not filesystem case policy.
 *
 * @evidence contracts/common.md#principled-implementation A named tracked survivor is a content candidate; absent localization requires conservative coverage and membership refresh, while POSIX inode replacement additionally rearms per-file watches. A named untracked path refreshes membership when it holds members, is a directory a backend may not descend into, or carries a name the compiler or a member-proven mapper can read.
 * @evidence contracts/common.md#clear-and-simple-design Candidate selection precedes independent refresh/rearm policy with no backend-timing simulation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual tracked membership and existence qualify candidates instead of treating every notification as an edit or guessing missing filenames.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain directory-only events, replacement and unnamed notifications following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Platform selects backend handle rearming only; lexical key and conservative fallback matching use native parent-directory case observations, retaining sensitive and unknown names as distinct stored inputs.
 * @evidence contracts/performance.md#efficient-algorithms An indexed surviving hit avoids F-member traversal after delegated lexical key work. Other cases snapshot F borrowed values before filtering, so callbacks cannot change that traversal population; snapshot plus admitted arrays require O(F) references. Routing includes path/component/ancestor/case observations, key text and supplied existence callbacks; dimensions and native-query costs are uncapped. One transaction shares repeated case observations within the decision.
 * @evidence contracts/performance.md#reuse-equivalent-work The supplied reconciliation context shares equivalent parent-directory capability observations across key construction and candidate classification; standalone decisions start fresh observations rather than historical case assumptions.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The planner borrows tracked membership and returns invocation-local candidates, retaining no watcher, historical event population or independent resident cache.
 */
export function planCompilerDirectoryWatchEvent(input: {
  changed?: string;
  event: string;
  exists(location: string): boolean;
  /**
   * Whether an existing path is a directory; absent, every existing untracked
   * path refreshes membership, the conservative answer.
   */
  isDirectory?(location: string): boolean;
  identities?: ProjectInputPathIdentityContext;
  location: string;
  platform: NodeJS.Platform;
  trackedFiles: ReadonlyMap<string, string>;
}): CompilerDirectoryWatchEventPlan {
  const identities =
    input.identities ??
    createProjectInputPathIdentityContext({ throwOnRealpathError: false });
  const tracked =
    input.changed === undefined
      ? undefined
      : input.trackedFiles.get(identities.lexicalKey(input.changed));
  const candidates =
    input.changed === undefined
      ? [...input.trackedFiles.values()].filter(
          (file) =>
            input.exists(file) &&
            identities.lexicalIsWithin(input.location, path.resolve(file)),
        )
      : tracked !== undefined && input.exists(tracked)
        ? [tracked]
        : [...input.trackedFiles.values()].filter(
            (file) =>
              identities.lexicalMatches(file, input.changed!) &&
              input.exists(file),
          );
  if (input.changed === undefined) {
    return {
      changes: candidates,
      rearm: input.platform === "win32" ? [] : candidates,
      refresh: true,
    };
  }
  if (candidates.length === 0) {
    return {
      changes: [],
      rearm: [],
      refresh: namedEventMayMoveMembership(input, identities),
    };
  }
  if (input.platform === "win32") {
    return { changes: candidates, rearm: [], refresh: false };
  }
  if (input.event === "rename") {
    return { changes: candidates, rearm: candidates, refresh: false };
  }
  return { changes: candidates, rearm: [], refresh: false };
}

/**
 * Whether a named event for an untracked path can move compiler membership, so
 * that only it pays for a whole-Program listing (#1865).
 *
 * The compiler admits a root or a resolution only for a source, declaration,
 * JavaScript or JSON name (`package.json` and configs included), or for an
 * extension a content mapper already admitted, which a current member shows. A
 * path holding tracked members can drop them. A directory can hold files the
 * compiler would read; on the recursive Windows and macOS backends its entries
 * report events of their own, so only a directory moved in or out (`rename`)
 * needs the listing there, while a per-directory backend lists for any
 * directory event. Every other named path, such as a log, a lock file or a
 * build product the compiler never reads, leaves membership as it was.
 */
function namedEventMayMoveMembership(
  input: Parameters<typeof planCompilerDirectoryWatchEvent>[0],
  identities: ProjectInputPathIdentityContext,
): boolean {
  const changed = path.resolve(input.changed!);
  for (const file of input.trackedFiles.values())
    if (identities.lexicalIsWithin(changed, path.resolve(file))) return true;
  if (input.exists(changed)) {
    // A caller that cannot tell directories apart gets the listing.
    if (input.isDirectory === undefined) return true;
    if (input.isDirectory(changed))
      return (
        input.event === "rename" ||
        (input.platform !== "win32" && input.platform !== "darwin")
      );
  }
  if (ProjectInputWatchRules.projectInputPathMayAffectProgram(changed))
    return true;
  const extension = path.extname(changed).toLowerCase();
  if (extension === "") return false;
  for (const file of input.trackedFiles.values())
    if (path.extname(file).toLowerCase() === extension) return true;
  return false;
}
