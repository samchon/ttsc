import { type SpawnSyncReturns } from "node:child_process";

import { isSpawnSyncFdExhaustion } from "../../internal/isSpawnSyncFdExhaustion";
import { spawnSyncResilient } from "../../internal/spawnSyncResilient";
import { captureProcessOutput } from "./captureProcessOutput";
import { ensureExecutable } from "./ensureExecutable";

/**
 * Spawn a native binary (or a Node.js script when the path has a JS/TS
 * extension) and return its result with decoded or raw-buffer output streams.
 *
 * Streams go to private files and are materialized after exit, avoiding the
 * piped maxBuffer ceiling while retaining filesystem and runtime allocation
 * limits. Filesystem read failures propagate after capture cleanup. A caller
 * whose command starts no process of its own may capture through pipes without
 * a buffer ceiling instead, which is much cheaper for a command that writes its
 * report one line per system call; a pipe that cannot be created falls back to
 * the files.
 *
 * When `options.encoding` is omitted it defaults to `"utf8"`. Pass `"buffer"`
 * when the caller needs raw bytes.
 *
 * @evidence contracts/common.md#principled-implementation Executable plus argv are passed directly to Node spawning; script candidates instead pass their path to process.execPath, and file-backed or unbounded piped output reconstructs the normal stdout/stderr/output result fields. Pipes are used only when the caller states the command starts no descendant that could hold them open.
 * @evidence contracts/common.md#clear-and-simple-design This operation owns synchronous execution and capture lifetime; permission preparation, low-descriptor recovery and byte decoding remain explicit delegated boundaries.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No shell parses argv or foreign process API is replaced. Descriptor recovery is selected by the real resource-exhaustion contract in spawnSyncResilient rather than a fixture outcome.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain executable routing, capture limits, read errors and encoding ownership following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Node receives native executable and argument arrays, Windows hiding is an explicit process option, and POSIX permission preparation remains in ensureExecutable rather than shell-specific commands.
 * @evidence contracts/performance.md#efficient-algorithms Argument-reference copying costs O(A); native argv/environment launch work, permission checks, capture acquisition and any broker retry/report costs are delegated but remain part of this call. Reads/decoding allocate complete output proportional to B child bytes. Each stream is read once after synchronous completion; neither output size nor child duration is capped here.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A child execution may have effects and depend on arbitrary filesystem state; this wrapper has no equivalence or invalidation contract permitting reuse of a previous process result.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources An acquired capture reaches finally on spawn, recovery and read failures; acquisition has its own rollback attempts. Disposal attempts closure/removal with suppressed failures, so native release is not certified. Materialized output transfers to the caller, and capture/returned bytes grow without a configured ceiling; no timeout or descendant-join policy is supplied here.
 */
export function spawnNative(
  binary: string,
  args: readonly string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    encoding?: BufferEncoding | "buffer";

    /**
     * Capture through pipes instead of files. Only for a command that starts no
     * process of its own, such as the upstream compiler: a descendant that
     * inherits a pipe keeps the call waiting until it exits.
     */
    pipe?: boolean;
  },
): SpawnSyncReturns<string | Buffer> {
  const viaNode = /\.(?:[cm]?js|ts)$/i.test(binary);
  if (!viaNode) {
    ensureExecutable(binary);
  }
  if (options.pipe === true) {
    // The compiler writes each line of a report with its own system call. On
    // Windows a write to a file pays the filesystem filter stack every time,
    // and a module-resolution trace took three times as long captured to a
    // file as through a pipe (samchon/ttsc#1859).
    const result = spawnSyncResilient(
      viaNode ? process.execPath : binary,
      viaNode ? [binary, ...args] : [...args],
      {
        cwd: options.cwd,
        env: options.env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        maxBuffer: Infinity,
      },
    );
    // A pipe that cannot be created leaves the file capture, whose
    // descriptor-exhaustion recovery the pipe lane does not have.
    if (!isSpawnSyncFdExhaustion(result.error)) {
      const decode = (bytes: Buffer | null): string | Buffer => {
        const buffer = bytes ?? Buffer.alloc(0);
        return options.encoding === "buffer"
          ? buffer
          : buffer.toString(options.encoding ?? "utf8");
      };
      const stdout = decode(result.stdout as Buffer | null);
      const stderr = decode(result.stderr as Buffer | null);
      return {
        ...result,
        output: [null, stdout, stderr],
        stderr,
        stdout,
      } as SpawnSyncReturns<string | Buffer>;
    }
  }
  const capture = captureProcessOutput();
  try {
    const result = spawnSyncResilient(
      viaNode ? process.execPath : binary,
      viaNode ? [binary, ...args] : [...args],
      {
        cwd: options.cwd,
        env: options.env,
        stdio: ["ignore", capture.stdoutFd, capture.stderrFd],
        windowsHide: true,
      },
      { stderr: capture.stderrPath, stdout: capture.stdoutPath },
    );
    const stdout = capture.read("stdout", options.encoding);
    const stderr = capture.read("stderr", options.encoding);
    return {
      ...result,
      output: [null, stdout, stderr],
      stderr,
      stdout,
    } as SpawnSyncReturns<string | Buffer>;
  } finally {
    capture.dispose();
  }
}
