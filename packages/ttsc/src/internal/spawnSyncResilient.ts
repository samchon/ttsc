import { type SpawnSyncOptions, spawnSync } from "node:child_process";

import { E2ETrace } from "./E2ETrace";
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
 * 0..2; that child opens its own capture files and attempts to spawn the
 * original command without a shell. Fresh initialization reduces inherited
 * descriptor pressure but does not prove a numeric descriptor ceiling or
 * successful recovery.
 *
 * Broker callers supply file-backed output and no stdin input or shell mode. It
 * does not reconstruct arbitrary spawn stdio contracts. Opt-in private tracing
 * observes this actual attempt and any broker/target separately; it adds
 * metadata/output-byte sink work without changing results.
 *
 * @evidence contracts/common.md#principled-implementation Ordinary spawning is retained; only POSIX EBADF with explicit capture paths selects one isolated broker retry. That error class permits the retry but does not prove descriptor height was the original cause or guarantee retry success.
 * @evidence contracts/common.md#clear-and-simple-design This operation selects between the ordinary path and one broker owner; file capture and output reconstruction remain the callers' responsibility.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The retry targets the supported descriptor-limit failure class without converting an ordinary command failure into fabricated success; it neither patches spawn nor substitutes target output.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the POSIX descriptor constraint and the supported file-output/no-input/no-shell broker scope, with separated acknowledgments.
 * @evidence contracts/portability.md#os-neutral-implementation Native executable/argv are passed to Node spawning; only POSIX EBADF invokes the isolated broker and Windows retains its supported ordinary spawning path.
 * @evidence contracts/performance.md#efficient-algorithms One ordinary spawn copies A argument references and delegates argument/environment/native launch work. Error-message classification adds text cost; one admitted failure can add broker option/argv serialization, report IO/parsing and target spawning. Enabled private tracing additionally serializes metadata/returned output and writes its budgeted sink. No retry loop is introduced, and input/output/native costs are not bounded by two owner calls.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Arbitrary command execution has external effects, so matching commands and arguments cannot authorize sharing completed results.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources Synchronous spawn owns completion; timeout sends its configured kill signal but does not guarantee immediate exit. The broker owns its report lifecycle, capture files remain caller-owned and returned results transfer to the caller. Forced broker termination does not establish that every target descendant released inherited resources.
 */
export function spawnSyncResilient(
  command: string,
  args: readonly string[],
  options: SpawnSyncOptions,
  output?: SpawnSyncOutputFiles,
): ReturnType<typeof spawnSync> {
  const nativeArgs = [...args];
  const trace = E2ETrace.begin(
    command,
    nativeArgs,
    options,
    "spawnSyncResilient",
  );
  const result = spawnSync(command, nativeArgs, options);
  E2ETrace.result(trace, result);
  if (
    output === undefined ||
    process.platform === "win32" ||
    !isSpawnSyncFdExhaustion(result.error)
  ) {
    return result;
  }
  return spawnSyncWithLowDescriptors(command, args, options, output);
}
