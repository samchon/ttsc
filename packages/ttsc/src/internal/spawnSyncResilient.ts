import { type SpawnSyncOptions, spawnSync } from "node:child_process";

import type { SpawnSyncOutputFiles } from "./SpawnSyncOutputFiles";
import { isSpawnSyncFdExhaustion } from "./isSpawnSyncFdExhaustion";
import { spawnSyncWithLowDescriptors } from "./spawnSyncWithLowDescriptors";

/**
 * Spawn synchronously, retrying POSIX EBADF failures without high source FDs.
 *
 * Darwin's posix_spawn rejects a dup2 source descriptor at or above OPEN_MAX. A
 * process with many unrelated watchers can therefore make Node-created pipes or
 * file-backed stdio fail before the executable starts. The ordinary path is
 * unchanged. An EBADF retry starts a Node broker with inherited descriptors
 * 0..2; that clean child opens the capture files on low descriptors and spawns
 * the original command without a shell.
 */
export function spawnSyncResilient(
  command: string,
  args: readonly string[],
  options: SpawnSyncOptions,
  output?: SpawnSyncOutputFiles,
): ReturnType<typeof spawnSync> {
  const result = spawnSync(command, [...args], options);
  if (
    output === undefined ||
    process.platform === "win32" ||
    !isSpawnSyncFdExhaustion(result.error)
  ) {
    return result;
  }
  return spawnSyncWithLowDescriptors(command, args, options, output);
}
