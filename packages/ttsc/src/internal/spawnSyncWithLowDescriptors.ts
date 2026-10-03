import { type SpawnSyncOptions, spawnSync } from "node:child_process";
import fs from "node:fs";

import { E2ETrace } from "./E2ETrace";
import type { SpawnSyncOutputFiles } from "./SpawnSyncOutputFiles";

/**
 * Launch through a fresh shell-free child broker with inherited stdio 0..2.
 *
 * The caller owns stdout/stderr capture files and reconstructs their contents;
 * this operation returns command status and errors through a private report.
 * Its supported broker mode ignores stdin and uses no shell. It does not
 * reproduce arbitrary spawn input or stdio modes. Native initialization or
 * inherited preloads can still allocate descriptors; low numeric descriptor
 * values and successful target launch are not guaranteed. Parsed JSON report
 * fields are trusted after syntax parsing rather than structurally validated.
 * Enabled private tracing observes the broker and target as separate actual
 * primitives, loading the same private observer in the broker. Its root travels
 * in private broker arguments without altering the target environment. Trace
 * loading/write failures leave missing evidence while target results remain
 * unchanged; optional observation adds native IO and metadata/output work.
 *
 * @evidence contracts/common.md#principled-implementation A fresh Node child inherits only descriptors zero through two, opens owned capture files itself and launches the actual argv; its private status report preserves target exit and native error information rather than broker status alone.
 * @evidence contracts/common.md#clear-and-simple-design One broker boundary separates descriptor acquisition from the already loaded parent; caller-owned capture remains external and the private result file carries only status/error metadata.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The isolated broker addresses actual POSIX source-descriptor limits without patching spawn or inventing compiler output; unreadable or syntactically invalid JSON reports become protocol errors, while parsed field shapes are trusted; no shell quoting workaround is introduced.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish command results from file-backed output and state no-input/no-shell support, with separate acknowledgment tags.
 * @evidence contracts/portability.md#os-neutral-implementation Supported POSIX fallback passes executable and argv without shell syntax; Node opens captures inside the broker. cwd/env configure that broker; argv0, uid/gid, killSignal and timeout are forwarded to its target. Other arbitrary spawn modes are not reconstructed.
 * @evidence contracts/performance.md#efficient-algorithms One broker is attempted and, if its initialization succeeds, it attempts one target. Option/argv/report serialization, report UTF-8 read/JSON parsing and native/env/path work scale with their inputs. Target output remains in caller capture files; temporary report/metadata text and native work have no adapter quota.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Command spawning and file output have external effects; this owner cannot share them solely because command and argv match.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources Child descriptor closure and parent report removal are attempted in finally; failures are suppressed and capture-owner directory cleanup is also best effort. Omitted timeout leaves the broker unbounded; a supplied timeout adds five seconds to its broker option, including timeout zero becoming five seconds here. A timeout signal need not end the process immediately, and forced broker termination does not join every target descendant.
 */
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
  // Only an enabled observer needs the private compiled helper path. Failure
  // to load the observer leaves missing evidence, not a different command.
  let traceModule = "";
  if (process.env.TTSC_E2E_TRACE) {
    try {
      traceModule = require.resolve("./E2ETrace");
    } catch {}
  }
  try {
    const brokerArgs = [
      "-e",
      LOW_DESCRIPTOR_BROKER_SOURCE,
      "--",
      report,
      output.stdout,
      output.stderr,
      targetOptions,
      traceModule,
      process.env.TTSC_E2E_TRACE ?? "",
      command,
      ...args,
    ];
    const brokerOptions: SpawnSyncOptions = {
      cwd: options.cwd,
      encoding: undefined,
      env: options.env,
      input: undefined,
      killSignal: options.killSignal,
      shell: false,
      stdio: [0, 1, 2],
      timeout: brokerTimeout,
      windowsHide: true,
    };
    const trace = E2ETrace.begin(
      process.execPath,
      brokerArgs,
      brokerOptions,
      "low-descriptor-broker",
    );
    const broker = spawnSync(process.execPath, brokerArgs, brokerOptions);
    E2ETrace.result(trace, broker);
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
const [report, stdout, stderr, encodedOptions, traceModule, traceRoot, command, ...args] = process.argv.slice(1);
const options = JSON.parse(encodedOptions);
let traceObserver;
if (traceRoot && traceModule) {
  try { traceObserver = require(traceModule).E2ETrace; } catch {}
}
let stdoutFd;
let stderrFd;
let result;
try {
  stdoutFd = fs.openSync(stdout, "w");
  stderrFd = stderr === stdout ? stdoutFd : fs.openSync(stderr, "w");
  const trace = traceObserver?.begin(command, args, options, "low-descriptor-target", traceRoot);
  result = childProcess.spawnSync(command, args, {
    ...options,
    shell: false,
    stdio: ["ignore", stdoutFd, stderrFd],
  });
  traceObserver?.result(trace, result);
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
