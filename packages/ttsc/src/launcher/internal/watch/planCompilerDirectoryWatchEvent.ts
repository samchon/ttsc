import path from "node:path";

import type { ProjectInputPathIdentityContext } from "../../../internal/pathIdentity/ProjectInputPathIdentityContext";
import { createProjectInputPathIdentityContext } from "../../../internal/pathIdentity/createProjectInputPathIdentityContext";
import type { CompilerDirectoryWatchEventPlan } from "./CompilerDirectoryWatchEventPlan";

/**
 * Plan one compiler-directory event without relying on backend timing.
 *
 * A named content change of a tracked file is a candidate on every platform. On
 * POSIX the file has a watcher of its own too, and either can miss what the
 * other hears: on macOS a directory watch has heard a config edit its file
 * watch never delivered. Both are decided from the bytes
 * (`WatchTopology.compilerChangesToReport`), so the first to see the edit
 * reports it once. A named rename re-arms the replaced file; an unnamed event
 * conservatively re-arms and reports every surviving tracked input below the
 * watch root. Windows has no per-file watchers here.
 *
 * Native case observations belong to `identities`, shared with the caller's
 * reconciliation or created fresh here. An exact indexed member is preferred; a
 * missing key conservatively routes eligible lexical aliases without merging
 * stored members. `platform` controls rearming, not filesystem case policy.
 *
 * @evidence contracts/common.md#principled-implementation A named tracked survivor is a content candidate; absent localization requires conservative coverage and membership refresh, while POSIX inode replacement additionally rearms per-file watches.
 * @evidence contracts/common.md#clear-and-simple-design Candidate selection precedes independent refresh/rearm policy with no backend-timing simulation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual tracked membership and existence qualify candidates instead of treating every notification as an edit or guessing missing filenames.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain directory-only events, replacement and unnamed notifications following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Platform selects backend handle rearming only; lexical key and conservative fallback matching use native parent-directory case observations, retaining sensitive and unknown names as distinct stored inputs.
 * @evidence contracts/performance.md#efficient-algorithms A named indexed hit avoids scanning F tracked files after D-component key construction; unnamed events or a missing key require one O(FD) routing pass, with native case queries memoized within the decision.
 * @evidence contracts/performance.md#reuse-equivalent-work The supplied reconciliation context shares equivalent parent-directory capability observations across key construction and candidate classification; standalone decisions start fresh observations rather than historical case assumptions.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The planner borrows tracked membership and returns invocation-local candidates, retaining no watcher, historical event population or independent resident cache.
 */
export function planCompilerDirectoryWatchEvent(input: {
  changed?: string;
  event: string;
  exists(location: string): boolean;
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
    return { changes: [], rearm: [], refresh: true };
  }
  if (input.platform === "win32") {
    return { changes: candidates, rearm: [], refresh: false };
  }
  if (input.event === "rename") {
    return { changes: candidates, rearm: candidates, refresh: false };
  }
  return { changes: candidates, rearm: [], refresh: false };
}
