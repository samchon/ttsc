import fs from "node:fs";
import path from "node:path";
import type { PluginBuildLockFence } from "./PluginBuildLockFence";
import { PluginBuildLockProtocol } from "./PluginBuildLockProtocol";

/**
 * Retire exactly the generation carried by an abandoned observation.
 *
 * Exported for deterministic multi-process tests.
 */
export function reclaimPluginBuildLock(
  lockDir: string,
  fence: PluginBuildLockFence,
): boolean {
  if (fence.protocol === "v2") {
    return PluginBuildLockProtocol.retireV2PluginBuildLock(
      PluginBuildLockProtocol.pluginBuildLockProtocolDir(lockDir),
      fence.generation,
    );
  }
  return retireLegacyPluginBuildLock(lockDir, fence.generation);
}

function retireLegacyPluginBuildLock(
  lockDir: string,
  generation: string,
): boolean {
  if (!PluginBuildLockProtocol.isPluginBuildLockGeneration(generation)) return false;
  const captured = PluginBuildLockProtocol.readLegacyPluginBuildLockFence(
    path.join(lockDir, PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_LEGACY_FENCE_DIR),
  );
  if (captured?.fence.generation !== generation) {
    return false;
  }
  const destination = `${lockDir}.retired-${generation}`;
  try {
    fs.renameSync(lockDir, destination);
    return true;
  } catch (error) {
    if (
      PluginBuildLockProtocol.isMissingPathError(error) ||
      PluginBuildLockProtocol.isRenameDestinationOccupied(error, destination)
    ) {
      return false;
    }
    throw error;
  }
}
