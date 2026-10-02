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
   * A target inside the project selects the nearest existing directory at or
   * above the project root. For an external target, candidates are the nearest
   * existing directories of its declared parent and its own tree, in that order.
   * A candidate strictly containing the project is refused; one with the
   * project's own identity is allowed. If neither candidate is admitted, the
   * result is undefined. This selects a root under current native observations;
   * it starts no watcher and does not prove future event delivery.
   *
   * @evidence contracts/common.md#principled-implementation Internal declarations select existing ancestry of the project root; external candidates cannot strictly contain the project and displace its distinct root selection, while equal physical identity is admitted.
   * @evidence contracts/common.md#clear-and-simple-design Internal and external ownership branches share one physical identity policy and nearest-existing-directory helper.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts An unsafe external owner remains undefined instead of adding a broad ancestor watch to disguise lost observation.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain missing trees, parent preference and the containment ceiling with their reasons, following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Native resolve/dirname supply ancestry; the supplied transaction compares physical roots and actual case semantics, including symlink aliases.
   * @evidence contracts/performance.md#efficient-algorithms Construction of a default identity context precedes selection. The internal branch makes one native ancestor-stat search; the external branch eagerly makes both parent and target searches before candidate admission. Identity resolution/containment adds path-text, ancestor and possible case-query work through the shared context; no descendant corpus is enumerated and depth/text/query populations are not capped here.
   * @evidence contracts/performance.md#reuse-equivalent-work The transaction shares equivalent native identity resolutions across root and ceiling comparisons for this selection; later selections can use fresh state.
   *
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Selection returns an optional path without acquiring a watcher or retaining history. A supplied identity context remains caller-owned; a default context and its observation maps are invocation-local and become reclaimable after their references are discarded.
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
    // An external anchor prefers the declared parent so missing trees and
    // sibling declarations can select the same observation root. Installation
    // and actual delivery remain with the topology owner. The root
    // may not rise strictly past the project: a containing root can displace
    // its distinct root selection when roots are merged. Declining avoids that
    // broader selection; it does not establish what a shared ancestor watcher
    // would deliver. Prefer the declared parent, fall back to the target's own
    // tree, and allow equality with the project root.
    for (const candidate of [
      WatchPaths.nearestExistingDirectory(path.dirname(resolvedTarget)),
      WatchPaths.nearestExistingDirectory(resolvedTarget),
    ]) {
      if (candidate === undefined) continue;
      // The project root cannot outrank itself in the merge, so it is the one
      // container that is never a swallow — it is the owner the internal branch
      // would have chosen when it exists. An in-project directory symlink can
      // produce the same physical root here; that alias must remain eligible.
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
   * root of a declared glob. This predicate classifies declaration ancestry;
   * watcher retirement and native delivery remain the topology owner's decisions.
   *
   * @evidence contracts/common.md#principled-implementation Files and glob roots anchor containing coverage; reload-directory membership alone requires a strict containing directory. Other declaration categories can independently anchor the same path.
   * @evidence contracts/common.md#clear-and-simple-design Four short-circuited declaration categories remain visible under one anchor predicate.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No project directory is treated as an anchor without an actual declaration, and reload membership is not widened to its whole subtree.
   * @evidence contracts/common.md#meaningful-documentation Native prose states each category and the strict reload-directory relation following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation All ancestry and equal-root distinctions use the supplied actual filesystem identity transaction.
   * @evidence contracts/performance.md#efficient-algorithms At most F files, R reload declarations and G globs are visited with short-circuiting. Each containment/equality query can resolve native identities and inspect key text; globs additionally compute their literal root. Costs include declaration spelling, ancestor/entry/case observations and native queries, not just F+R+G. No declared corpus contents are enumerated.
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
          // This category anchors a strict containing directory, not the reload
          // directory itself. Its immediate membership does not by itself
          // declare a descendant corpus; other file/glob declarations above or
          // below this branch can still anchor that same directory.
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
