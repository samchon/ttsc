import { type SpawnSyncOptions, spawnSync } from "node:child_process";
import fs from "node:fs";

export interface SpawnSyncOutputFiles {
  stderr: string;
  stdout: string;
}

interface SerializedSpawnError {
  code?: string;
  errno?: number;
  message: string;
  name?: string;
  path?: string;
  spawnargs?: string[];
  syscall?: string;
}

interface SerializedSpawnResult {
  error?: SerializedSpawnError;
  pid: number;
  signal: NodeJS.Signals | null;
  status: number | null;
}

let nextBrokerResult = 0;

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

/** Launch through a shell-free child broker that owns only low descriptors. */
export function spawnSyncWithLowDescriptors(
  command: string,
  args: readonly string[],
  options: SpawnSyncOptions,
  output: SpawnSyncOutputFiles,
): ReturnType<typeof spawnSync> {
  const report = `${output.stdout}.ttsc-result-${process.pid}-${nextBrokerResult++}`;
  const targetOptions = JSON.stringify({
    ...(options.argv0 === undefined ? {} : { argv0: options.argv0 }),
    ...(options.gid === undefined ? {} : { gid: options.gid }),
    ...(options.killSignal === undefined
      ? {}
      : { killSignal: options.killSignal }),
    ...(options.timeout === undefined ? {} : { timeout: options.timeout }),
    ...(options.uid === undefined ? {} : { uid: options.uid }),
  });
  const brokerTimeout =
    options.timeout === undefined ? undefined : options.timeout + 5_000;
  try {
    const broker = spawnSync(
      process.execPath,
      [
        "-e",
        LOW_DESCRIPTOR_BROKER_SOURCE,
        "--",
        report,
        output.stdout,
        output.stderr,
        targetOptions,
        command,
        ...args,
      ],
      {
        cwd: options.cwd,
        encoding: undefined,
        env: options.env,
        input: undefined,
        killSignal: options.killSignal,
        shell: false,
        stdio: [0, 1, 2],
        timeout: brokerTimeout,
        windowsHide: true,
      },
    );
    if (broker.error !== undefined) return broker;
    if (broker.status !== 0) {
      return brokerProtocolFailure(
        broker,
        `exited with status ${String(broker.status)}`,
      );
    }
    let parsed: SerializedSpawnResult;
    try {
      parsed = JSON.parse(fs.readFileSync(report, "utf8"));
    } catch (error) {
      return brokerProtocolFailure(
        broker,
        error instanceof Error ? error.message : String(error),
      );
    }
    return {
      ...broker,
      ...(parsed.error === undefined
        ? { error: undefined }
        : { error: deserializeSpawnError(parsed.error) }),
      pid: parsed.pid,
      signal: parsed.signal,
      status: parsed.status,
    };
  } finally {
    try {
      fs.rmSync(report, { force: true });
    } catch {
      // The capture owner removes the containing directory after reading it.
    }
  }
}

/** Whether libuv rejected process stdio because a source descriptor was high. */
export function isSpawnSyncFdExhaustion(error: Error | undefined): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "EBADF" || error?.message.includes("EBADF") === true;
}

function deserializeSpawnError(serialized: SerializedSpawnError): Error {
  const error = new Error(serialized.message) as NodeJS.ErrnoException & {
    path?: string;
    spawnargs?: string[];
  };
  if (serialized.name !== undefined) error.name = serialized.name;
  if (serialized.code !== undefined) error.code = serialized.code;
  if (serialized.errno !== undefined) error.errno = serialized.errno;
  if (serialized.path !== undefined) error.path = serialized.path;
  if (serialized.spawnargs !== undefined)
    error.spawnargs = serialized.spawnargs;
  if (serialized.syscall !== undefined) error.syscall = serialized.syscall;
  return error;
}

function brokerProtocolFailure(
  broker: ReturnType<typeof spawnSync>,
  reason: string,
): ReturnType<typeof spawnSync> {
  const error = new Error(
    `ttsc: low-descriptor spawn broker failed: ${reason}`,
  ) as NodeJS.ErrnoException;
  error.code = "EIO";
  return { ...broker, error, signal: null, status: null };
}

const LOW_DESCRIPTOR_BROKER_SOURCE = String.raw`
const childProcess = require("node:child_process");
const fs = require("node:fs");
const [report, stdout, stderr, encodedOptions, command, ...args] = process.argv.slice(1);
const options = JSON.parse(encodedOptions);
let stdoutFd;
let stderrFd;
let result;
try {
  stdoutFd = fs.openSync(stdout, "w");
  stderrFd = stderr === stdout ? stdoutFd : fs.openSync(stderr, "w");
  result = childProcess.spawnSync(command, args, {
    ...options,
    shell: false,
    stdio: ["ignore", stdoutFd, stderrFd],
  });
} catch (error) {
  result = { error, pid: 0, signal: null, status: null };
} finally {
  if (stderrFd !== undefined && stderrFd !== stdoutFd) {
    try { fs.closeSync(stderrFd); } catch {}
  }
  if (stdoutFd !== undefined) {
    try { fs.closeSync(stdoutFd); } catch {}
  }
}
const sourceError = result.error;
const error = sourceError === undefined ? undefined : {
  code: sourceError.code,
  errno: sourceError.errno,
  message: sourceError.message,
  name: sourceError.name,
  path: sourceError.path,
  spawnargs: sourceError.spawnargs,
  syscall: sourceError.syscall,
};
fs.writeFileSync(report, JSON.stringify({
  ...(error === undefined ? {} : { error }),
  pid: result.pid,
  signal: result.signal,
  status: result.status,
}));
`;
