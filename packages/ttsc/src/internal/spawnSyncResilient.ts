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
 *
 * Broker callers supply file-backed output and no stdin input or shell mode. It
 * does not reconstruct arbitrary spawn stdio contracts.
 *
 * @evidence contracts/common.md#principled-implementation Ordinary spawning is retained; only POSIX EBADF with explicit capture paths retries through a clean child whose low file descriptors satisfy the native spawn constraint.
 * @evidence contracts/common.md#clear-and-simple-design This operation selects between the ordinary path and one broker owner; file capture and output reconstruction remain the callers' responsibility.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The retry addresses actual source-descriptor exhaustion instead of hiding a compiler failure; it neither patches spawn nor substitutes results.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the POSIX descriptor constraint and the supported file-output/no-input/no-shell broker scope, with separated acknowledgments.
 * @evidence contracts/portability.md#os-neutral-implementation Native executable/argv are passed to Node spawning; only POSIX EBADF invokes the isolated broker and Windows retains its supported ordinary spawning path.
 * @evidence contracts/performance.md#efficient-algorithms Argument copying is O(A) total argument data and ordinary spawning occurs once; only one relevant failure adds one broker launch, with no retry loop.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Arbitrary command execution has external effects, so matching commands and arguments cannot authorize sharing completed results.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources The synchronous spawn owns its child until completion or its configured timeout; broker reporting lifetime is delegated to its owner and returned results transfer to the caller.
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
