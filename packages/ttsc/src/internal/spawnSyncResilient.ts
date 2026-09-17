import { type SpawnSyncOptions, spawnSync } from "node:child_process";

export interface SpawnSyncOutputFiles {
  stderr: string;
  stdout: string;
}

/**
 * Spawn synchronously, retrying POSIX EBADF failures without high source FDs.
 *
 * Darwin's posix_spawn rejects a dup2 source descriptor at or above OPEN_MAX.
 * A process with many unrelated watchers can therefore make Node-created pipes
 * or file-backed stdio fail before the executable starts. The ordinary path is
 * unchanged; only EBADF retries through /bin/sh with inherited descriptors
 * 0..2, and the child shell opens the capture files after it has spawned.
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

/** Launch through a child-side redirect using only inherited descriptors 0..2. */
export function spawnSyncWithLowDescriptors(
  command: string,
  args: readonly string[],
  options: SpawnSyncOptions,
  output: SpawnSyncOutputFiles,
): ReturnType<typeof spawnSync> {
  const redirect =
    output.stdout === output.stderr
      ? 'exec "$command" "$@" </dev/null >"$stdout" 2>&1'
      : 'exec "$command" "$@" </dev/null >"$stdout" 2>"$stderr"';
  return spawnSync(
    "/bin/sh",
    [
      "-c",
      [
        'command=$1; stdout=$2; stderr=$3; shift 3',
        redirect,
      ].join("\n"),
      "ttsc-spawn",
      command,
      output.stdout,
      output.stderr,
      ...args,
    ],
    {
      ...options,
      encoding: undefined,
      input: undefined,
      shell: false,
      stdio: [0, 1, 2],
    },
  );
}

/** Whether libuv rejected process stdio because a source descriptor was high. */
export function isSpawnSyncFdExhaustion(error: Error | undefined): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "EBADF" || error?.message.includes("EBADF") === true;
}
