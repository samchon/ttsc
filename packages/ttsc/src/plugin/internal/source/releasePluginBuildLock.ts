import type { PluginBuildLockLease } from "./PluginBuildLockLease";
import { PluginBuildLockProtocol } from "./PluginBuildLockProtocol";

/** Retire a held generation during the holder's `finally`. */
export function releasePluginBuildLock(
  lockDir: string,
  lease: PluginBuildLockLease,
): boolean {
  return PluginBuildLockProtocol.retireV2PluginBuildLock(
    PluginBuildLockProtocol.pluginBuildLockProtocolDir(lockDir),
    lease.generation,
  );
}
