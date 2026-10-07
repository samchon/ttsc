import { spawn, type SpawnSyncOptions, type SpawnSyncReturns } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveBinary } from "../compiler/internal/resolveBinary";

/**
 * Execute one command under the platform helper's process-tree owner.
 * Cancellation closes the control pipe; completion is accepted only after the
 * helper's joined child and empty-boundary receipt, never merely its exit code.
 *
 * @evidence contracts/common.md#principled-implementation Exact command arguments and environment are sent to the selected native owner; its structurally checked completion receipt supplies tree-shutdown authority before callers release build resources. A missing or invalid proof retains private protocol storage and reports unknown retirement.
 * @evidence contracts/common.md#clear-and-simple-design Node owns asynchronous streams and cancellation while the native helper owns OS containment and wait semantics.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unsupported helper versions and missing cleanup receipts reject; no ordinary uncontained spawn substitutes for cancellation safety.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the pipe and receipt ownership and the absence of a process-exit-only success path.
 * @evidence contracts/portability.md#os-neutral-implementation The published platform helper resolver selects the executable; exact JSON argv/env avoid a new shell quoting layer, including explicit Windows verbatim command lines.
 * @evidence contracts/performance.md#efficient-algorithms Output accumulation follows the caller's spawn buffer policy, while file-backed descriptor outputs remain streaming. Encoding and receipt serialization scale with actual payload bytes.
 * @evidence contracts/performance.md#reuse-equivalent-work Each command has its own containment lifetime and cannot share a result based on matching arguments.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The completion owner waits for helper close and its tree receipt before removing private protocol storage; stream and abort listeners are removed on settlement. Unknown retirement retains the exact reported private path and rejects; qualified closure or external closure verification is required before reclaiming it.
 */
export namespace OwnedNativeProcess {
  /**
   * Run a command with Node's synchronous-result shape after real async joining.
   * Explicit input bytes and standard output descriptors are supported. Shell,
   * uid/gid, inherited stdin and additional descriptor modes are refused.
   * Cancellation and timeout force termination of the owned native boundary;
   * a custom softer kill signal is therefore refused. TTSC_BINARY retains its
   * helper authority, so an override must implement this protocol version.
   * The optional internal observer receives the actual retirement class even
   * when cancellation or a compiler error rejects the operation. Unknown
   * retirement preserves protocol inputs and does not certify child closure.
   *
   * @evidence contracts/common.md#principled-implementation A private request carries exact command/options and a structurally checked native receipt is required after helper close; cancellation returns only after joined and empty-boundary proof.
   * @evidence contracts/common.md#clear-and-simple-design Control stdin is separate from target input, target output streams remain unchanged, and one finally owns listeners and private protocol storage.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unsupported modes and incompatible helper overrides reject explicitly rather than falling back to an uncontained child or asserting cleanup from helper exit alone.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain supported descriptor/input modes, forced retirement and helper override compatibility; the namespace describes the native ownership split.
   * @evidence contracts/portability.md#os-neutral-implementation The existing native helper resolver owns platform and override precedence; JSON argv/env and explicit Windows verbatim mode preserve the actual command boundary without an added shell layer.
   * @evidence contracts/performance.md#efficient-algorithms Piped output is accumulated up to maxBuffer per stream and file-backed outputs stream through inherited descriptors. Input encoding processes only the supplied view bytes; protocol serialization and receipts scale with their payloads.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Commands can produce external effects and every admitted invocation has its own process boundary and result.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Abort closes the control pipe, then helper close and its native retirement receipt are awaited before private storage is removed. Missing or failed cleanup proof rejects and retains the exact protocol path; a classified failed spawn removes unused storage. The observer transfers classification to the source-resource owner rather than manufacturing a joined result from helper exit.
   */
  export async function run(
    command: string,
    args: readonly string[],
    options: SpawnSyncOptions,
    signal?: AbortSignal,
    observeRetirement?: (state: "joined" | "not-started" | "unknown", reason?: string) => void,
  ): Promise<SpawnSyncReturns<string | Buffer>> {
    signal?.throwIfAborted();
    if (options.shell || options.uid !== undefined || options.gid !== undefined)
      throw new Error("ttsc: owned native commands do not support shell, uid or gid overrides");
    if (options.killSignal !== undefined && options.killSignal !== "SIGKILL" && options.killSignal !== 9)
      throw new Error("ttsc: owned native commands require forced process-tree termination");
    const inputMode = Array.isArray(options.stdio) ? options.stdio[0] : options.stdio;
    if (inputMode === "inherit" || typeof inputMode === "number" ||
      (Array.isArray(options.stdio) && options.stdio.length > 3))
      throw new Error("ttsc: owned native commands require explicit input bytes and standard output descriptors");
    const binary = resolveBinary({ env: options.env });
    if (binary === null) throw new Error("ttsc: native process supervisor is unavailable");
    // Convert all potentially throwing caller data before acquiring a process
    // or protocol directory. An invalid encoding must not strand a helper.
    const input = options.input;
    const bytes = input === undefined ? undefined : typeof input === "string"
      ? Buffer.from(input, options.encoding && options.encoding !== "buffer" ? options.encoding : "utf8")
      : Buffer.from(new Uint8Array(input.buffer, input.byteOffset, input.byteLength));
    const env = Object.fromEntries(Object.entries(options.env ?? process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
    const payload = `${JSON.stringify({
      version: 1,
      command,
      args: [...args],
      cwd: path.resolve(options.cwd === undefined ? process.cwd() : typeof options.cwd === "string" ? options.cwd : fileURLToPath(options.cwd)),
      env,
      ...(bytes === undefined ? {} : { inputBase64: bytes.toString("base64") }),
      windowsVerbatimArguments: options.windowsVerbatimArguments === true,
      ...(options.argv0 === undefined ? {} : { argv0: options.argv0 }),
      ...(options.timeout === undefined ? {} : { timeoutMs: options.timeout }),
    })}\n`;
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-owned-process-"));
    const resultFile = path.join(directory, "result.json");
    let retirement: "joined" | "not-started" | "unknown" = "not-started";
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const limit = options.maxBuffer ?? 1024 * 1024;
    let overflow: Error | undefined;
    let stdoutBytes = 0;
    let stderrBytes = 0;
    const stdio = options.stdio;
    const output = (index: 1 | 2) => Array.isArray(stdio)
      ? (stdio[index] ?? "pipe")
      : stdio === "inherit" || stdio === "ignore" ? stdio : "pipe";
    const child = (() => {
      try {
        return spawn(binary, ["__source-process", "--result", resultFile], {
          cwd: options.cwd,
          env: options.env ?? process.env,
          windowsHide: true,
          stdio: ["pipe", output(1), output(2)],
        });
      } catch (error) {
        fs.rmSync(directory, { recursive: true, force: true });
        throw error;
      }
    })();
    retirement = "unknown";
    const cancel = () => child.stdin?.end();
    child.stdin?.on("error", () => undefined);
    const collect = (channel: "stdout" | "stderr", chunk: Buffer) => {
      const count = channel === "stdout" ? (stdoutBytes += chunk.length) : (stderrBytes += chunk.length);
      if (count <= limit) (channel === "stdout" ? stdout : stderr).push(chunk);
      else if (overflow === undefined) {
        overflow = Object.assign(new Error("ttsc: owned command output exceeded maxBuffer"), { code: "ENOBUFS" });
        cancel();
      }
    };
    child.stdout?.on("data", (chunk: Buffer) => collect("stdout", chunk));
    child.stderr?.on("data", (chunk: Buffer) => collect("stderr", chunk));
    signal?.addEventListener("abort", cancel, { once: true });
    let spawnError: Error | undefined;
    const closed = new Promise<void>((resolve) => {
      child.on("error", (error) => { spawnError = error; });
      child.once("close", () => resolve());
    });
    // An abort after listener installation must not authorize target admission.
    if (signal?.aborted) cancel();
    else {
      child.stdin?.write(payload);
    }
    let originalFailure: unknown;
    let failed = false;
    try {
      await closed;
      if (spawnError !== undefined) {
        // Node's failed spawn has no process owner or admitted target.
        if (child.pid === undefined) retirement = "not-started";
        throw spawnError;
      }
      let receipt: Receipt;
      try { receipt = JSON.parse(fs.readFileSync(resultFile, "utf8")) as Receipt; }
      catch (cause) { throw new Error("ttsc: native supervisor did not publish a completion receipt", { cause }); }
      if (receipt === null || typeof receipt !== "object" || receipt.version !== 1 || !Number.isSafeInteger(receipt.pid) || receipt.pid < 0 ||
        (receipt.status !== null && (!Number.isSafeInteger(receipt.status) || receipt.pid === 0)) ||
        (receipt.signal !== null && (typeof receipt.signal !== "string" || receipt.signal.length === 0)) ||
        typeof receipt.cancelled !== "boolean" ||
        (receipt.error !== undefined && (typeof receipt.error?.code !== "string" || typeof receipt.error?.message !== "string")) ||
        receipt.cleanup?.directChildJoined !== true || receipt.cleanup?.boundaryEmpty !== true ||
        !["owned", "os", "windows-job"].includes(receipt.cleanup.orphanReaping))
        throw new Error("ttsc: native supervisor did not confirm process-tree retirement");
      retirement = "joined";
      signal?.throwIfAborted();
      const encoding = options.encoding;
      const decode = (chunks: Buffer[]) => {
        const bytes = Buffer.concat(chunks);
        return encoding && encoding !== "buffer" ? bytes.toString(encoding) : bytes;
      };
      const out = child.stdout === null ? null : decode(stdout);
      const err = child.stderr === null ? null : decode(stderr);
      const failure = overflow ?? (receipt.error === undefined ? undefined : Object.assign(new Error(receipt.error.message), { code: receipt.error.code }));
      return {
        pid: receipt.pid,
        status: receipt.status,
        signal: receipt.signal as NodeJS.Signals | null,
        output: [null, out, err],
        stdout: out as string | Buffer,
        stderr: err as string | Buffer,
        ...(failure === undefined ? {} : { error: failure }),
      };
    } catch (error) {
      failed = true;
      originalFailure = error;
      throw error;
    } finally {
      signal?.removeEventListener("abort", cancel);
      child.stdin?.destroy();
      observeRetirement?.(retirement, failed ? String(originalFailure) : undefined);
      // A failed proof does not authorize deleting a native reader's protocol
      // inputs. The exact retained path is part of the terminal diagnostic.
      if (retirement === "unknown") {
        throw new Error(`ttsc: native retirement is unknown; retained protocol ${directory}`, {
          cause: originalFailure,
        });
      }
      try { fs.rmSync(directory, { recursive: true, force: true }); }
      catch (error) {
        throw failed ? new AggregateError([originalFailure, error], "ttsc: native protocol cleanup failed") : error;
      }
    }
  }
}

interface Receipt {
  version: number;
  pid: number;
  status: number | null;
  signal: string | null;
  error?: { code: string; message: string };
  cancelled: boolean;
  cleanup?: { directChildJoined: boolean; boundaryEmpty: boolean; orphanReaping: string };
}
