import fs from "node:fs";
import path from "node:path";

import { pluginSourceCovers } from "./pluginSourceCovers";

/**
 * Reject source-build input conflicts at their existing admission points.
 * Existing readers/builders still acquire module information and materialize
 * sources; these operations establish admission of the inputs they receive.
 *
 * @evidence contracts/common.md#principled-implementation The real builder uses package, cache-containment and managed-replacement checks at their existing acquisition boundaries.
 * @evidence contracts/common.md#clear-and-simple-design One source admission concern groups rejection policy without a toolchain or build executor.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Admission does not replace native acquisition, certify a supplied proof or fabricate compiled output.
 * @evidence contracts/common.md#meaningful-documentation Native prose separates supplied/read inputs from source materialization and compilation.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The namespace groups members; members own native path/file decisions.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Members own their processing decisions rather than this grouping.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This grouping owns no shared build/evaluation cache.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The namespace owns no registry, open handle or retained task.
 */
export namespace SourcePluginAdmission {
  /**
   * Refuse a contributor whose source root has its own go.mod. The observation
   * is existence only, as in the original merge loop; copying and compilation
   * remain later builder operations.
   *
   * @evidence contracts/common.md#principled-implementation Native existence at the exact contributor-root go.mod rejects module ownership before that contributor is copied into the host module.
   * @evidence contracts/common.md#clear-and-simple-design One observed package-admission guard retains the original named diagnostic.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No compiler, toolchain probe or supplied success marker replaces the actual existence observation.
   * @evidence contracts/common.md#meaningful-documentation Native prose states existence-only observation and separates later copying/building.
   * @evidence contracts/portability.md#os-neutral-implementation node:path joins the native root and basename; node:fs observes native existence without separator or case assumptions.
   * @evidenceExclude contracts/performance.md#efficient-algorithms This single native metadata admission owns no population-processing algorithm; native lookup work is delegated to fs.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Current native existence is required and is not cached by this guard.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The existence query opens no caller-owned handle and retains no source population.
   */
  export function requireContributorPackage(
    pluginName: string,
    contributor: { readonly name: string; readonly source: string },
  ): void {
    if (fs.existsSync(path.join(contributor.source, "go.mod")))
      throw new Error(
        `ttsc: plugin "${pluginName}" contributor "${contributor.name}" must ship Go ` +
          `source as a package, not a module (go.mod found at ${contributor.source}/go.mod). ` +
          `Remove go.mod so the contributor compiles inside the host module's dependency graph.`,
      );
  }

  /**
   * Refuse caches among source directories included by the key's path policy.
   * Excluded directories such as node_modules retain that policy's meaning;
   * this lexical containment is not proof of physical alias identity.
   *
   * @evidence contracts/common.md#principled-implementation Each cache/source pair uses the same directory-kind pluginSourceCovers policy as source inclusion, rejecting a cache that would mutate its keyed source.
   * @evidence contracts/common.md#clear-and-simple-design One guard owns pair ordering and the diagnostic naming the conflicting cache/source.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No key or compiler output is assumed valid merely because a path passes lexical containment.
   * @evidence contracts/common.md#meaningful-documentation Native prose states source inclusion, excluded-directory behavior and the physical-identity limitation.
   * @evidence contracts/portability.md#os-neutral-implementation Native path.resolve and pluginSourceCovers preserve the current native path grammar without universal case folding.
   * @evidence contracts/performance.md#efficient-algorithms Up to C times S pair checks delegate path-relative/component scans; an admitted population performs all pairs and the first conflict throws, without filesystem enumeration.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Current supplied roots are checked directly; this guard does not cache source keys or compiled results.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Pair traversal retains no root history or native handle; diagnostic/result lifetime belongs to the caller.
   */
  export function requireCachesOutsideSources(
    caches: readonly string[],
    sources: readonly string[],
  ): void {
    for (const cache of caches)
      for (const source of sources)
        if (pluginSourceCovers(source, path.resolve(cache), "directory"))
          throw new Error(
            `ttsc: the cache ${cache} lies inside the plugin source ${source}, ` +
              `which the plugin's binary is keyed on, so every build would change ` +
              `the source it was keyed on. Place the cache outside the plugin's ` +
              `sources; the default one, in node_modules, already is.`,
          );
  }

  /**
   * Identify compiler/shim module names whose replacement ttsc owns. This is
   * module-name policy, not a lookup of a physical Go module.
   *
   * @evidence contracts/common.md#principled-implementation Exact ttsc/compiler roots and the compiler shim namespace retain the existing managed-module discriminants.
   * @evidence contracts/common.md#clear-and-simple-design Both replacement rejection and workspace filtering use this same predicate.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Module-name policy does not fabricate filesystem module identity or compiled provenance.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes module-name classification from physical lookup.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Go module identifiers are supplied strings, not native filesystem paths.
   * @evidenceExclude contracts/performance.md#efficient-algorithms Exact/prefix string comparisons own no population-processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Current module text is classified without retained lookup results.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No native handle, module registry or task is acquired or retained.
   */
  export function isManagedModule(modulePath: string): boolean {
    return (
      modulePath === "github.com/samchon/ttsc/packages/ttsc" ||
      modulePath === "github.com/microsoft/typescript-go" ||
      modulePath.startsWith("github.com/microsoft/typescript-go/shim/")
    );
  }

  /**
   * Reject managed or overlay module replacements observed in source go.mod.
   * The caller retains its ttsc-root exemption and acquires overlay names only
   * after finding source replacements, preserving reader effect ordering.
   *
   * @evidence contracts/common.md#principled-implementation The first source replacement matching managed-name policy or the acquired overlay set produces the original rejection diagnostic.
   * @evidence contracts/common.md#clear-and-simple-design This operation consumes observed module names while the real reader remains with the builder.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Supplied replacement records do not certify their native acquisition or replace a Go compiler.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the caller's root exemption and acquisition-order responsibility.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Supplied Go module identifiers are compared without filesystem paths or native process calls.
   * @evidence contracts/performance.md#efficient-algorithms One ordered pass over R replacement records delegates string classification and Set membership, throwing at the first forbidden record without copying the population.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This decision consumes current supplied observations and retains no cross-build cache.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This guard retains no replacement history, native handle or task.
   */
  export function requireSourceReplacements(
    replacements: readonly { readonly modulePath: string }[],
    overlayModules: ReadonlySet<string>,
    pluginName: string,
  ): void {
    for (const replacement of replacements)
      if (
        isManagedModule(replacement.modulePath) ||
        overlayModules.has(replacement.modulePath)
      )
        throw new Error(
          `ttsc: plugin "${pluginName}" go.mod replaces ttsc-managed module ` +
            `${JSON.stringify(replacement.modulePath)}. Remove this replace directive; ` +
            `ttsc supplies its own compiler and shim modules while building source plugins.`,
        );
  }
}
