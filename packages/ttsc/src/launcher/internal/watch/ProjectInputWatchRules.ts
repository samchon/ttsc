import path from "node:path";

import { type ProjectInputPathIdentityContext } from "../../../internal/pathIdentity/ProjectInputPathIdentityContext";
import { createProjectInputPathIdentityContext } from "../../../internal/pathIdentity/createProjectInputPathIdentityContext";
import type { ITtscProjectInputSnapshot } from "../../../structures/internal/ITtscProjectInputSnapshot";
import { WatchPaths } from "./WatchPaths";
import { literalGlobRoot } from "./literalGlobRoot";

/**
 * Rules for watching the inputs project rules declare beyond the TypeScript
 * Program (documents, schemas, generated sources).
 *
 * They decide which directory a declared input is observed through, whether a
 * directory still anchors any declaration after a change, and whether a changed
 * path can affect the compiler's Program rather than only a rule.
 *
 * @evidence contracts/common.md#principled-implementation Declaration ancestry, safe observation roots and compiler-capable extensions remain distinct inputs to watch decisions.
 * @evidence contracts/common.md#clear-and-simple-design One namespace groups project-input classification helpers without owning handles or notification scheduling.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Root rules follow supplied declarations and physical identity instead of fixture directories or guessed plugin behavior.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs identify root ownership, retained declarations and Program effects following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Boundary helpers use actual filesystem identity transactions and native ancestry; source-extension policy is separate from native case capability.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms Member operations choose their algorithms; namespace representation performs no computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The namespace contains no independent reuse coordinator.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This namespace acquires no watcher or resident state.
 */
export namespace ProjectInputWatchRules {
  /**
   * Whether a file extension is one TypeScript-Go compiles or emits.
   *
   * @evidence contracts/common.md#principled-implementation The fixed supported source-extension set identifies compiler-capable inputs without asserting that every such file belongs to the current Program.
   * @evidence contracts/common.md#clear-and-simple-design One bounded membership predicate is shared by topology and population invalidation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Extensions are compiler contract discriminants rather than consumer or fixture special cases.
   * @evidence contracts/common.md#meaningful-documentation Native prose states compiler/emit capability following the documentation skill.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Extension membership owns no native path or filesystem identity operation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms The fixed eight-item semantic set has no workload-dependent collection strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Classification owns no repeated-work coordinator.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No state or native resource survives the predicate.
   */
  export function isCompilerEmittableSourceExtension(
    extension: string,
  ): boolean {
    return [
      ".cjs",
      ".cts",
      ".js",
      ".jsx",
      ".mjs",
      ".mts",
      ".ts",
      ".tsx",
    ].includes(extension);
  }

  /**
   * The directory a recursive watcher for `target` should be installed on.
   *
   * A target inside the project is observed through the project's own root. One
   * outside it is observed through the nearest existing directory of its
   * declared parent, or failing that of its own tree, so a tree that does not
   * exist yet is still seen. Either candidate is refused when it contains the
   * project, and `undefined` is returned rather than watching the whole project
   * from above.
   *
   * @evidence contracts/common.md#principled-implementation Internal declarations use the project root; external declarations select existing ancestry without allowing a root that contains and swallows the project's own coverage.
   * @evidence contracts/common.md#clear-and-simple-design Internal and external ownership branches share one physical identity policy and nearest-existing-directory helper.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts An unsafe external owner remains undefined instead of adding a broad ancestor watch to disguise lost observation.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain missing trees, parent preference and the containment ceiling with their reasons, following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Native resolve/dirname supply ancestry; the supplied transaction compares physical roots and actual case semantics, including symlink aliases.
   * @evidence contracts/performance.md#efficient-algorithms At most two ancestor searches visit D directory levels; containment uses the same transaction instead of pairwise root population scans.
   * @evidence contracts/performance.md#reuse-equivalent-work The transaction shares equivalent native identity resolutions across root and ceiling comparisons for this selection; later selections can use fresh state.
   *
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Root selection returns an optional path without opening or retaining a watcher.
   */
  export function projectInputRecursiveWatchRoot(
    target: string,
    projectRoot: string,
    identities = createProjectInputPathIdentityContext(),
  ): string | undefined {
    const resolvedTarget = path.resolve(target);
    const resolvedProjectRoot = path.resolve(projectRoot);
    if (identities.isWithin(resolvedProjectRoot, resolvedTarget)) {
      return WatchPaths.nearestExistingDirectory(resolvedProjectRoot);
    }
    // An external anchor rises to the declared parent so a tree that does not
    // exist yet is still observed, and so siblings under it share one handle. It
    // may not rise past the project, though: a directory that contains the
    // project swallows the project's own root when the two are merged, and every
    // in-project declaration then rides one recursive handle over a shared system
    // directory — a temp root, or the filesystem root itself — which delivers
    // nothing. Prefer the declared parent, fall back to the target's own tree,
    // and decline rather than widen past the project.
    for (const candidate of [
      WatchPaths.nearestExistingDirectory(path.dirname(resolvedTarget)),
      WatchPaths.nearestExistingDirectory(resolvedTarget),
    ]) {
      if (candidate === undefined) continue;
      // The project root cannot outrank itself in the merge, so it is the one
      // container that is never a swallow — it is the owner the internal branch
      // would have chosen anyway. A declaration reached through an in-project
      // directory symlink lands here, and rejecting it would drop the hoist that
      // keeps a replaced directory from stranding a child handle.
      if (
        identities.resolve(candidate).key !==
          identities.resolve(resolvedProjectRoot).key &&
        identities.isWithin(candidate, resolvedProjectRoot)
      ) {
        continue;
      }
      return candidate;
    }
    return undefined;
  }

  /**
   * Whether `directory` contains any declaration of the snapshot: a declared
   * file, a reload file, a reload directory strictly below it, or the literal
   * root of a declared glob. A watch root that anchors nothing can be dropped.
   *
   * @evidence contracts/common.md#principled-implementation Files and glob roots anchor containing coverage; reload-directory fingerprints cover immediate membership, so a directory does not anchor itself recursively.
   * @evidence contracts/common.md#clear-and-simple-design Four short-circuited declaration categories remain visible under one anchor predicate.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No project directory is treated as an anchor without an actual declaration, and reload membership is not widened to its whole subtree.
   * @evidence contracts/common.md#meaningful-documentation Native prose states each category and the strict reload-directory relation following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation All ancestry and equal-root distinctions use the supplied actual filesystem identity transaction.
   * @evidence contracts/performance.md#efficient-algorithms At most F files, R reload declarations and G globs require O(F+R+G) short-circuited containment checks without enumerating corpus contents.
   * @evidence contracts/performance.md#reuse-equivalent-work The caller's shared transaction caches repeated identity lookups across anchor and root-selection questions for one native state.
   *
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The predicate borrows declarations and the transaction; it opens no watcher and retains no history.
   */
  export function projectInputAnchorsDeclaration(
    snapshot: ITtscProjectInputSnapshot,
    directory: string,
    identities: ProjectInputPathIdentityContext,
  ): boolean {
    return (
      snapshot.files.some((file) => identities.isWithin(directory, file)) ||
      (snapshot.reloadFiles ?? []).some((file) =>
        identities.isWithin(directory, file),
      ) ||
      (snapshot.reloadDirectories ?? []).some(
        (entry) =>
          // A reload directory anchors the directory that contains it, never
          // itself. Its own fingerprint is a digest of its immediate entries, so
          // nothing below it can reach the corpus, and treating it as its own
          // anchor would rearm for every entry created directly inside it —
          // including `node_modules`, which contributors publish as one.
          identities.isWithin(directory, entry) &&
          identities.resolve(directory).key !== identities.resolve(entry).key,
      ) ||
      snapshot.globs.some((glob) =>
        identities.isWithin(directory, literalGlobRoot(glob)),
      )
    );
  }

  /**
   * Whether a changed project input could change the TypeScript Program: a
   * source or emittable extension, or JSON, which `resolveJsonModule` imports
   * and tsconfig files are written in.
   *
   * @evidence contracts/common.md#principled-implementation JSON and recognized source extensions can alter compiler inputs even when also selected as project-rule data.
   * @evidence contracts/common.md#clear-and-simple-design One normalized native extension delegates the compiler-source set to its owning predicate.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The capability set follows compiler semantics rather than named project fixtures.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains JSON's dual data/config role following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Native extname extracts the extension without separator assumptions; extension case normalization is language policy, not filesystem identity folding.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms One path extension and a fixed semantic set select no growing-population algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Classification coordinates no equivalent computation requests.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No retained state or resource is acquired.
   */
  export function projectInputPathMayAffectProgram(location: string): boolean {
    const extension = path.extname(location).toLowerCase();
    return (
      extension === ".json" || isCompilerEmittableSourceExtension(extension)
    );
  }
}
