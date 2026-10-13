import path from "node:path";

import { isTransformTarget } from "../isTransformTarget";
import type { ResolvedTtscUnpluginOptions } from "../options/ResolvedTtscUnpluginOptions";
import type { TtscTransformCache } from "./cache/TtscTransformCache";
import { transformCacheEpoch } from "./cache/transformCacheEpoch";
import { transformFilesystem } from "./cache/transformFilesystem";
import { pluginsAreDisabled } from "./utils/pluginsAreDisabled";

/**
 * Schedule explicitly selected source entries before the host reaches their
 * imports. Compilation and proof stay with the ordinary transform core.
 *
 * A host often discovers its next workspace project only after the preceding
 * project's transform finishes (#1764). Starting known entries together avoids
 * that dependency on host traversal order. Walking unrelated projects would
 * execute plugins the user never selected, so this owner uses only the supplied
 * entries. Preparation leaves module delivery and host registration to the
 * actual request.
 *
 * @evidence contracts/common.md#principled-implementation Explicit entries authorize scheduling; the supplied core capture retains project selection, configuration identity and all generation proofs. The context contains the current working directory, options, aliases and delivery epoch, not new cache authority.
 * @evidence contracts/common.md#clear-and-simple-design One scheduler owns per-cache startup deduplication and reset; the transform core owns compiled generations and their disposal.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No directory-wide discovery, plugin substitution or skipped proof is introduced; preparation never impersonates a host module delivery.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains host traversal order, explicit effectful selection and separation from delivery; members state context lifetime and failure ownership.
 * @evidence contracts/portability.md#os-neutral-implementation Entries resolve through native path semantics from the current cwd and read through the cache's filesystem boundary; source eligibility uses the adapter's existing shared predicate.
 * @evidence contracts/performance.md#efficient-algorithms Each new context serializes cwd, options and aliases, then resolves and deduplicates E entries and reads their source bytes once. Capture starts without waiting for other entries; native capture and proof retain their own costs. Repeated requests serialize the context but do not reread the entries.
 * @evidence contracts/performance.md#reuse-equivalent-work One latest context per cache and epoch starts each entry once; ordinary project keys deduplicate entries in the same project. Context equality controls scheduling only, and retained results still need normal admission.
 * @evidence contracts/performance.md#bound-retention-and-release-resources A WeakMap retains one context string per live cache. Startup rejection handlers consume each detached promise; running captures and native resources remain cache-owned and withdrawal disposes their fulfilled generations. No cancellation deadline or entry-count cap is added.
 */
export namespace TtscPrecompilation {
  const contexts = new WeakMap<TtscTransformCache, string>();

  /**
   * Start every eligible explicit entry without waiting for its siblings.
   * Failed speculative preparation is reported when its module is requested, so
   * an unrelated delivered project's load can proceed.
   *
   * @evidence contracts/common.md#principled-implementation The context is installed before captures start, so recursive and concurrent deliveries cannot restart the same batch; only supported source entries reach normal core capture.
   * @evidence contracts/common.md#clear-and-simple-design One synchronous loop separates startup ownership from asynchronous capture settlement.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed entry reads are not fabricated as empty source, and rejected captures do not become successful output. Actual delivery remains the error boundary.
   * @evidence contracts/common.md#meaningful-documentation Prose states parallel startup and deferred error reporting; callback and context ownership remain explicit.
   * @evidence contracts/portability.md#os-neutral-implementation Native absolute entry paths are passed as exact paths to capture and source reads use the same cache-owned filesystem as generation validation.
   * @evidence contracts/performance.md#efficient-algorithms Context serialization precedes one E-entry deduplicating loop and actual source-byte reads; captures overlap their asynchronous work rather than being awaited sequentially.
   * @evidence contracts/performance.md#reuse-equivalent-work Identical latest cwd, options, aliases and epoch skip scheduling; project Promise identity and normal input proof decide compile reuse, independently of this scheduling record.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Context state follows its weak cache key. Every started capture receives a rejection handler immediately; its own core/cache owners release native resources, including withdrawal during capture.
   */
  export function start(
    cache: TtscTransformCache,
    options: ResolvedTtscUnpluginOptions,
    aliasPaths: Record<string, string[]> | undefined,
    capture: (file: string, source: string) => Promise<unknown>,
  ): void {
    if (
      options.precompile?.length === 0 ||
      options.precompile === undefined ||
      pluginsAreDisabled(options.plugins)
    )
      return;
    // Entry, project and projectRoot paths all use cwd. The same relative
    // options under another directory select different work, even if the
    // host retains its cache; capture coordinates must belong to this call.
    const cwd = process.cwd();
    const context = JSON.stringify([
      cwd,
      options,
      aliasPaths,
      transformCacheEpoch(cache),
    ]);
    if (contexts.get(cache) === context) return;
    contexts.set(cache, context);
    const entries = new Set<string>();
    const filesystem = transformFilesystem(cache);
    for (const entry of options.precompile) {
      if (!isTransformTarget(entry)) continue;
      const file = path.resolve(cwd, entry);
      if (entries.has(file)) continue;
      entries.add(file);
      try {
        const source = filesystem.readFile(file).toString("utf8");
        void capture(file, source).catch(() => undefined);
      } catch {
        // A missing entry must not poison another project's load. Its actual
        // host delivery still owns the native read error and recovery.
      }
    }
  }

  /**
   * End startup ownership when the cache withdraws its generations.
   *
   * @evidence contracts/common.md#principled-implementation Withdrawal removes scheduling state with generation ownership so a later lifecycle can prepare the same entries again.
   * @evidence contracts/common.md#clear-and-simple-design One weak-key deletion shares the cache's existing reset boundary.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Clearing scheduling permission does not admit or cancel any compiled result.
   * @evidence contracts/common.md#meaningful-documentation The headline identifies the same generation withdrawal boundary used by callers.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation WeakMap deletion performs no native operation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms One identity deletion chooses no traversal or processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation withdraws the previous scheduling record rather than reusing work.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Deletion releases the single scheduling record; native resources remain owned by generation withdrawal.
   */
  export function clear(cache: TtscTransformCache): void {
    contexts.delete(cache);
  }
}
