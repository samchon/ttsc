import { type SpawnSyncReturns } from "node:child_process";

import { spawnSyncResilient } from "../../internal/spawnSyncResilient";
import { captureProcessOutput } from "./captureProcessOutput";
import { ensureExecutable } from "./ensureExecutable";

/**
 * Spawn a native binary (or a Node.js script when the path has a JS/TS
 * extension) and return its result with `stdout` and `stderr` as text.
 *
 * Streams go to private files and are materialized after exit, avoiding the
 * piped maxBuffer ceiling while retaining filesystem and runtime allocation
 * limits. Filesystem read failures propagate after capture cleanup.
 *
 * When `options.encoding` is omitted it defaults to `"utf8"`. Pass `"buffer"`
 * when the caller needs raw bytes.
 *
 * @evidence contracts/common.md#principled-implementation Executable plus argv are passed directly to Node spawning; script candidates instead pass their path to process.execPath, and file-backed output reconstructs the normal stdout/stderr/output result fields.
 * @evidence contracts/common.md#clear-and-simple-design This operation owns synchronous execution and capture lifetime; permission preparation, low-descriptor recovery and byte decoding remain explicit delegated boundaries.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No shell parses argv or foreign process API is replaced. Descriptor recovery is selected by the real resource-exhaustion contract in spawnSyncResilient rather than a fixture outcome.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain executable routing, capture limits, read errors and encoding ownership following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Node receives native executable and argument arrays, Windows hiding is an explicit process option, and POSIX permission preparation remains in ensureExecutable rather than shell-specific commands.
 * @evidence contracts/performance.md#efficient-algorithms Argument copying costs O(A); capture reads and decoding cost O(B) for child output bytes, in addition to the child runtime. Each stream is read once after completion.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A child execution may have effects and depend on arbitrary filesystem state; this wrapper has no equivalence or invalidation contract permitting reuse of a previous process result.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources The invocation owns one capture until finally, including spawn, recovery and read failures. It returns materialized output to the caller; live file bytes and returned storage grow with child output without a configured ceiling.
 */
export function spawnNative(
  binary: string,
  args: readonly string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    encoding?: BufferEncoding | "buffer";
  },
): SpawnSyncReturns<string | Buffer> {
  const viaNode = /\.(?:[cm]?js|ts)$/i.test(binary);
  if (!viaNode) {
    ensureExecutable(binary);
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
