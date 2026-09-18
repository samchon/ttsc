import path from "node:path";
import { createProjectInputPathIdentityContext } from "../../../internal/pathIdentity/createProjectInputPathIdentityContext";
import type { ITtscProjectInputSnapshot } from "../../../structures/internal/ITtscProjectInputSnapshot";
import { WatchPaths } from "./WatchPaths";
import { ProjectInputWatchRules } from "./ProjectInputWatchRules";

/**
 * Whether a replacement at this path leaves a recursive watcher bound to the
 * object that was replaced.
 *
 * Only one backend needs the answer. Node routes a recursive watch to its own
 * per-directory implementation when the platform is neither macOS nor Windows,
 * and that implementation keys its handles by path: the handle for a directory
 * renamed away stays bound to the object that left, and any child whose name
 * survives the swap is skipped as already known. The native subtree backends
 * both other platforms use follow the path, so retiring their watcher would buy
 * nothing and would open a window in which no events are delivered.
 *
 * The answer is deliberately narrower than the rescan rule, because
 * reinstalling a root costs one watch descriptor per entry beneath it, which an
 * install storm would pay thousands of times. A directory appearing inside a
 * glob root deserves a rescan but replaces nothing a root stands on, and a
 * reload directory anchors the directory that contains it rather than itself,
 * since its fingerprint is a digest of its own immediate entries and nothing
 * below it can reach the declared corpus.
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
