import { PluginBuildEnvironmentReadings } from "ttsc/plugin-source";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { selectPluginSourceInputs } from "../envelope/selectPluginSourceInputs";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { trackerProvesInputUnchanged } from "../validation/trackerProvesInputUnchanged";
import { pluginSourceHolds } from "./pluginSourceHolds";

// A result's async owner records its execution responsibility even when native
// preparation failed. Synchronous standalone clients keep their native API;
// async proofs cannot silently fall back to it after an unavailable reading.
const asyncResults = new WeakSet<object>();

/**
 * Qualify actual plugin toolchain authority before synchronous input proofs.
 * Cold Go/environment/SDK work stays off the host thread. A mismatch requests
 * one fresh native environment reading; observation failure remains unavailable
 * and the following admission or replay validator retains its failure policy. A
 * resident generation can reuse its exact proven source state while healthy
 * notifications and the still-qualified environment witness both hold. Native
 * environment authority remains mandatory; source events cannot prove it.
 *
 * WARNING (#1712): yield before observing queued source changes, then qualify
 * all current readings in one synchronous batch. Missing readings require an
 * await and a fresh batch afterward. Source comparisons may request native
 * refreshes; the caller must establish another current proof after those
 * awaits. Never preserve a positive batch across an await or replay the SDK
 * witness independently for every plugin and nested validator.
 *
 * The project root reaches ttsc's environment worker, so that isolate proves
 * the Go SDK and executables from the plugin cache's records instead of
 * reading 135 MB of SDK once per bundler or runtime process (samchon/ttsc#1722).
 *
 * @param cached Optional resident generation whose existing source-state and
 *   environment witness may qualify source reuse. Other preparation owners
 *   retain direct source comparison.
 * @param projectRoot Project whose plugin cache holds those records; the
 *   resident generation's own root when omitted.
 * @evidence contracts/common.md#principled-implementation Every reported plugin directory qualifies current environment authority; only missing readings require asynchronous preparation. The same result's matching manifest state can share source proof only with a healthy exact-source tracker and the environment under which that tree was proven. Otherwise this operation compares source state once and a mismatch refreshes environment authority for the following owning validator to compare again; failed preparation cannot qualify an input.
 * @evidence contracts/common.md#clear-and-simple-design One async boundary precedes existing synchronous generation, delivery and terminal proofs.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing observations stay unproved; reported binary state never substitutes for native environment preparation or source comparison.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies off-thread work, mismatch refresh and preserved downstream failure ownership.
 * @evidence contracts/portability.md#os-neutral-implementation The same native toolchain/environment reader and caller filesystem source digest qualify each directory without platform guesses.
 * @evidence contracts/performance.md#efficient-algorithms The envelope selector indexes directories once per result. Linear directory passes batch-qualify current readings, prepare missing authority, compare source state and refresh mismatches. Each synchronous batch hashes variables once and shares distinct native dependencies; any preparation await requires another current batch. A qualified source witness avoids enumeration; other source comparisons enumerate and sort files, check metadata and hash bytes when the digest cannot be reused. A mismatch requests one environment refresh rather than a second source comparison here.
 * @evidence contracts/performance.md#reuse-equivalent-work The environment owner shares equivalent in-flight requests and still-qualified readings. Resident source proof is reused only for the exact result and manifest digest, unchanged qualified environment and currently healthy covered source notifications; absent, dirty, replaced or unavailable witnesses retain direct proof. No epoch or quiet watcher alone authorizes reuse, and subsequent admission still owns its current validation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources This module records asynchronous execution ownership in a WeakSet before preparation, including failures, so disposed results are not retained. Requests and worker lifetimes remain with the environment owner; this sequential operation awaits each request and acquires no native observer or independent cancellation handle.
 */
export async function preparePluginBuildEnvironments(
  result: TtscCachedProjectTransform["result"],
  filesystem: TtscTransformFilesystemOperations,
  cached?: TtscCachedProjectTransform,
  projectRoot: string | undefined = cached?.projectRoot,
): Promise<void> {
  asyncResults.add(result);
  const sources = selectPluginSourceInputs(result);
  // Preserve the async preparation boundary even for warm environments.
  // Events queued by the caller before awaiting preparation must participate
  // in the source witness below. Observe the batch after this yield, never
  // carry a positive environment observation across it (#1712).
  await Promise.resolve();
  const current = PluginBuildEnvironmentReadings.cachedAll(sources.keys());
  let awaited = false;
  for (const directory of sources.keys()) {
    if (current.get(directory) !== undefined) continue;
    awaited = true;
    try {
      await PluginBuildEnvironmentReadings.prepare(
        directory,
        false,
        projectRoot,
      );
    } catch {
      // Keep unavailable authority for admission rather than cold fallback.
    }
  }
  const environments = awaited
    ? PluginBuildEnvironmentReadings.cachedAll(sources.keys())
    : current;
  const refresh: string[] = [];
  for (const [directory, state] of sources) {
    try {
      const environment = environments.get(directory);
      if (
        cached?.result === result &&
        cached.hostInputValidation?.trees.get(directory) === state &&
        environment !== undefined &&
        cached.hostInputValidation.treeEnvironments?.get(directory) ===
          environment &&
        trackerProvesInputUnchanged(cached.hostInputMutationTracker, directory)
      )
        continue;
      if (
        !pluginSourceHolds(directory, state, filesystem, {
          environment,
        })
      )
        refresh.push(directory);
    } catch {
      // Admission and terminal recovery interpret unavailable proof in their
      // own domain; this boundary never upgrades it to a successful reading.
    }
  }
  for (const directory of refresh) {
    try {
      await PluginBuildEnvironmentReadings.prepare(
        directory,
        true,
        projectRoot,
      );
    } catch {
      // Synchronous admission requalifies after this asynchronous window.
    }
  }
}

/**
 * Whether this result's owner attempted asynchronous native preparation. This
 * records execution ownership, never successful observation authority.
 *
 * @evidence contracts/common.md#principled-implementation Result identity distinguishes async-owned proof from a standalone synchronous observation; membership does not certify any environment reading.
 * @evidence contracts/common.md#clear-and-simple-design One identity query selects which execution owner may prepare missing native authority.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed preparation also records async ownership, preventing an accidental cold synchronous fallback or fabricated successful proof.
 * @evidence contracts/common.md#meaningful-documentation Native prose separates execution responsibility from reading validity.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Identity membership performs no native operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms The fixed identity query selects an existing execution policy; it chooses no traversal or processing strategy and performs no toolchain probe.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The query selects an execution policy, not a reusable native observation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The preparation operation owns weak identity registration; this query borrows that record and acquires or retains no additional resource.
 */
export function usesPreparedPluginBuildEnvironments(
  result: TtscCachedProjectTransform["result"],
): boolean {
  return asyncResults.has(result);
}
