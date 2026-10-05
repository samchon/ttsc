import { PluginBuildEnvironmentReadings } from "ttsc/plugin-source";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { selectPluginSourceInputs } from "../envelope/selectPluginSourceInputs";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { pluginSourceHolds } from "./pluginSourceHolds";

// A result's async owner records its execution responsibility even when native
// preparation failed. Synchronous standalone clients keep their native API;
// async proofs cannot silently fall back to it after an unavailable reading.
const asyncResults = new WeakSet<object>();

/**
 * Prepare actual plugin toolchain authority before synchronous input proofs.
 * Cold Go/environment/SDK work stays off the host thread. A mismatch requests
 * one fresh native environment reading; observation failure remains unavailable
 * and the following admission or replay validator retains its failure policy.
 *
 * @evidence contracts/common.md#principled-implementation Every reported plugin directory prepares its actual current environment. This operation compares source state once and a mismatch refreshes environment authority for the following owning validator to compare again; failed preparation cannot qualify an input.
 * @evidence contracts/common.md#clear-and-simple-design One async boundary precedes existing synchronous generation, delivery and terminal proofs.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing observations stay unproved; reported binary state never substitutes for native environment preparation or source comparison.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies off-thread work, mismatch refresh and preserved downstream failure ownership.
 * @evidence contracts/portability.md#os-neutral-implementation The same native toolchain/environment reader and caller filesystem source digest qualify each directory without platform guesses.
 * @evidence contracts/performance.md#efficient-algorithms The envelope selector builds its directory map once per result, and preparation visits each reported directory once. Environment requests build keys from effective variables and qualify native dependencies; source comparison enumerates and sorts files, checks metadata and hashes bytes when its digest cannot be reused. A mismatch requests one environment refresh rather than a second source comparison here.
 * @evidence contracts/performance.md#reuse-equivalent-work The environment owner shares equivalent in-flight requests and still-qualified readings; each generation retains its own source-state comparison.
 * @evidence contracts/performance.md#bound-retention-and-release-resources This module records asynchronous execution ownership in a WeakSet before preparation, including failures, so disposed results are not retained. Requests and worker lifetimes remain with the environment owner; this sequential operation awaits each request and acquires no native observer or independent cancellation handle.
 */
export async function preparePluginBuildEnvironments(
  result: TtscCachedProjectTransform["result"],
  filesystem: TtscTransformFilesystemOperations,
): Promise<void> {
  asyncResults.add(result);
  for (const [directory, state] of selectPluginSourceInputs(result)) {
    try {
      await PluginBuildEnvironmentReadings.prepare(directory);
      if (
        !pluginSourceHolds(directory, state, filesystem, {
          environment: PluginBuildEnvironmentReadings.cached(directory),
        })
      )
        await PluginBuildEnvironmentReadings.prepare(directory, true);
    } catch {
      // Admission and terminal recovery interpret unavailable proof in their
      // own domain; this boundary never upgrades it to a successful reading.
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
