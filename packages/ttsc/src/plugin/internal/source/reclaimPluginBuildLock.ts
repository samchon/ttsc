import path from "node:path";

import { retireLockDirectory } from "../../../internal/retireLockDirectory";
import type { PluginBuildLockFence } from "./PluginBuildLockFence";
import { PluginBuildLockProtocol } from "./PluginBuildLockProtocol";

/**
 * Retire exactly the generation carried by an abandoned observation.
 *
 * V3 retires by the observer-protected tombstone identity. Legacy retirement
 * first confirms its captured fence; old legacy executables cannot provide
 * atomic cooperation across their deletable path and the v3 namespace.
 *
 * Returns false when another retire already made progress or the fence is
 * invalid; unexpected filesystem failures propagate.
 *
 * @evidence contracts/common.md#principled-implementation V3 retirement uses the observed generation's reserved destination; legacy retirement checks its recorded token before using a distinct legacy tombstone path.
 * @evidence contracts/common.md#clear-and-simple-design One protocol dispatch delegates to the matching retirement primitive without taking acquisition or process-liveness responsibility.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Reclamation uses the caller's observed token rather than refreshing it to a successor or deleting current recursively; the legacy cooperation limitation remains explicit.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs describe the two protocol paths, race result, invalid fences, error propagation and the legacy limit before the tags.
 * @evidence contracts/portability.md#os-neutral-implementation path.join and retireLockDirectory own native rename differences; Windows sharing refusals use its capability probe instead of weakening retirement to unlinking.
 * @evidence contracts/performance.md#efficient-algorithms Retirement addresses one deterministic destination rather than scanning historical owners; costs include native path resolution and legacy fence JSON bytes. Eligible Windows refusals add sibling capability probes and synchronous poll waits, without a retry-count or elapsed-time bound; the probe does not establish a peer read as the refusal's cause.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Retirement changes ownership and cannot be reused as a cached boolean; repeated callers must attempt the generation's atomic destination themselves.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources Retirement transfers ownership into history; cooperating v3 collectors require holder/observer absence before removing it. Eligible native retries can block indefinitely, and best-effort probe removal may leave empty siblings. Legacy clients retain their documented cross-path cooperation limit.
 */
export function reclaimPluginBuildLock(
  lockDir: string,
  fence: PluginBuildLockFence,
): boolean {
  if (fence.protocol === "v3") {
    return PluginBuildLockProtocol.retireV3PluginBuildLock(
      PluginBuildLockProtocol.pluginBuildLockProtocolDir(lockDir),
      fence.generation,
    );
  }
  return fence.protocol === "legacy"
    ? retireLegacyPluginBuildLock(lockDir, fence.generation)
    : false;
}

function retireLegacyPluginBuildLock(
  lockDir: string,
  generation: string,
): boolean {
  if (!PluginBuildLockProtocol.isPluginBuildLockGeneration(generation))
    return false;
  const captured = PluginBuildLockProtocol.readLegacyPluginBuildLockFence(
    path.join(
      lockDir,
      PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_LEGACY_FENCE_DIR,
    ),
  );
  if (captured?.fence.generation !== generation) {
    return false;
  }
  return retireLockDirectory(lockDir, `${lockDir}.retired-${generation}`, () =>
    PluginBuildLockProtocol.sleepSync(
      PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_POLL_MS,
    ),
  );
}
