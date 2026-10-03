import path from "node:path";

import { createProjectInputPathIdentityContext } from "../../../internal/pathIdentity/createProjectInputPathIdentityContext";
import type { ITtscProjectInputSnapshot } from "../../../structures/internal/ITtscProjectInputSnapshot";
import { ProjectInputWatchRules } from "./ProjectInputWatchRules";
import { WatchPaths } from "./WatchPaths";

/**
 * Select a directory attention that requests recursive watcher reinstallation.
 *
 * Node 22.15.0's `lib/fs.js` routes recursive watches to
 * `lib/internal/fs/recursive_watch.js` outside macOS and Windows. That
 * implementation records paths and skips an already registered path, motivating
 * this policy's rearm selection on those hosts. The predicate returns false for
 * macOS and Windows; that selection does not prove native subtree delivery after
 * replacement or that those backends follow every replaced path.
 *
 * On the selected backend, the supplied path must currently stat as a directory
 * and its parent must anchor at least one declared file, reload file, strict
 * reload-directory descendant or literal glob root. This is an attention policy,
 * not detection that an object was replaced. Restricting reinstallation avoids
 * repeatedly rebuilding a recursive entry population on unrelated changes.
 * Reload-directory membership alone anchors its parent rather than itself;
 * another declaration can still anchor that same path. The topology caller owns
 * retiring and synchronizing watchers before its next snapshot; this predicate
 * starts or closes no watcher and does not certify the resulting coverage.
 *
 * @param identities Identity transaction; absence creates a native host context.
 * @param platform Backend selection only; paths still use the host's path API
 *   and the supplied identity context, not this argument's foreign path grammar.
 *
 * @evidence contracts/common.md#principled-implementation The supported selection policy requests rearming only outside macOS/Windows for an existing directory whose parent anchors a declaration; its boolean is not proof of replacement or native event delivery.
 * @evidence contracts/common.md#clear-and-simple-design A backend capability branch precedes directory and declaration checks, separating rescan admission from handle reinstallation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Node's path-indexed registration supplies the rearm premise; actual directory/declaration observations select attention without test identities or an invented proof that native subtree backends always recover replacements.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain native versus per-directory backends and why indiscriminate reinstalling is costly, following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Platform selection expresses Node's recursive watcher implementation boundary; filesystem identity and containment still come from the actual transaction resolver.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The predicate starts or retains no watcher. A supplied identity context remains caller-owned; the default creates invocation-local observation maps without eviction, released only when their references are discarded.
 * @evidence contracts/performance.md#efficient-algorithms Default context allocation occurs before the platform return. Selected hosts resolve/stat one changed path and short-circuit over files, reload declarations and glob roots; each containment query can perform delegated identity/path/native work. No declared corpus enumeration or watcher installation occurs in this predicate, and text/declaration/query populations are not capped here.
 * @evidence contracts/performance.md#reuse-equivalent-work The topology caller supplies one identity transaction across attention and declaration checks, reusing per-key observations within that native state. Standalone default calls create fresh contexts; this predicate neither shares across transactions nor caches replacement verdicts.
 */
export function projectInputReplacementStrandsWatchers(
  snapshot: ITtscProjectInputSnapshot,
  location: string,
  identities = createProjectInputPathIdentityContext(),
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (platform === "darwin" || platform === "win32") return false;
  const changed = path.resolve(location);
  if (!WatchPaths.isDirectory(changed)) return false;
  return ProjectInputWatchRules.projectInputAnchorsDeclaration(
    snapshot,
    path.dirname(changed),
    identities,
  );
}
