import { type ChildProcess, spawn } from "node:child_process";
import { type Interface, createInterface } from "node:readline";

import { E2ETrace } from "../../internal/E2ETrace";
import type { ResidentReplyKind } from "./ResidentReplyKind";
import type { ResidentTransformProcessOptions } from "./ResidentTransformProcessOptions";
import type { ResidentTransformRequestOptions } from "./ResidentTransformRequestOptions";

/**
 * Async client for the long-lived `utility-host serve` process.
 *
 * The serve host answers newline-delimited requests within one process; its
 * producer owns project loading, transformed text and update semantics. This
 * class speaks that protocol: each {@link request} writes one JSON line and the host
 * replies with one line, matched FIFO. A transform request (`{"file":...}`) is
 * answered with `{"typescript":...,"found":...}`, and an update request
 * (`{"update":...,"content":...}`) with `{"updated":...}`.
 *
 * One resident process answers every request from one service instead of
 * spawning a fresh `transform` subprocess per call. Client construction does
 * not await startup compilation or certify a custom host's caching behavior.
 *
 * The caller owns disposal. Live requests have no deadline; queue population
 * and reply-line size depend on the caller and host, without a fixed cap.
 *
 * @evidence contracts/common.md#principled-implementation FIFO ownership follows the host's ordered request loop; malformed framing retires all slots, while a valid object with an invalid operation shape consumes and rejects only its own slot.
 * @evidence contracts/common.md#clear-and-simple-design The client owns one child, line reader, queue and terminal state; reply validation and settlement are private transport responsibilities distinct from the service's project policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing files and rejected edits remain legitimate negative replies; corrupt lines reject instead of becoming synthetic empty results or being rescued through foreign method replacement.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish operations, startup reuse, caller ownership and uncapped live requests, following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Node receives the executable, separate argv, native cwd and environment directly; supported pipe APIs carry protocol text without platform-specific shell quoting.
 * @evidence contracts/performance.md#efficient-algorithms A cursor advances through the FIFO with amortized constant queue settlement; consumed prefixes compact only when at least half the array has been consumed, and retirement drains outstanding calls once. Request serialization and reply parsing cost observed data/text volume, with caller serialization callbacks adding arbitrary work. Stderr conversion and concatenation scan each chunk plus the retained tail before truncation; native startup and host processing remain delegated.
 * @evidence contracts/performance.md#reuse-equivalent-work One startup-selected host is shared across requests; the client does not memoize responses across edits. Transformed-text state and ordered update behavior belong to the serve producer, not a custom-host cache guarantee established by this client.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Consumed slots release callbacks, settlement removes abort listeners, and retirement clears outstanding state and closes pipes. Stderr has a fixed tail cap, but pending calls and line bytes are uncapped and OS signaling may fail to terminate the child.
 */
export class ResidentTransformProcess {
  private readonly child: ChildProcess;
  private readonly reader: Interface;
  private readonly pending: (PendingRequest | undefined)[] = [];
  private pendingHead = 0;
  private stderr = "";
  private failure: Error | undefined;

  public constructor(options: ResidentTransformProcessOptions) {
    // Default stdio is "pipe" for stdin/stdout/stderr, which is exactly what the
    // line protocol needs; spelling it out as a string[] would not narrow to
    // StdioOptions, so it is left implicit.
    const nativeArgs = [...options.args];
    const trace = E2ETrace.begin(options.binary, nativeArgs, options, "resident-transform");
    this.child = spawn(options.binary, nativeArgs, {
      cwd: options.cwd,
      env: options.env,
      windowsHide: true,
    });
    E2ETrace.asynchronous(trace, this.child);
    const stdout = this.child.stdout;
    const stdin = this.child.stdin;
    if (stdout === null || stdin === null) {
      this.child.kill();
      throw new Error("ttsc: resident transform host has no stdio pipes");
    }
    this.reader = createInterface({ input: stdout });
    this.reader.on("line", (line) => this.onLine(line));
    // Drive completion off stdout's end, not the process "exit" event: every
    // buffered "line" is delivered before "close", so a reply that arrived just
    // before the host exited still resolves its request instead of racing the
    // exit-time rejection.
    this.reader.on("close", () => this.onReaderClose());
    this.child.stderr?.on("data", (chunk: Buffer | string) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      // Keep only the tail: stderr is consulted for the crash message, and a
      // long resident session can write diagnostics on every failed update.
      this.stderr = (this.stderr + text).slice(-STDERR_TAIL_LIMIT);
    });
    this.child.on("error", (error) => this.fail(error));
    // A dead host's pipes emit "error" (EPIPE on POSIX, often ECONNRESET on
    // Windows). Without these listeners Node turns a pipe error into an uncaught
    // exception that crashes the whole consumer process; route them through
    // fail() (stderr is non-critical) so a pipe death fails in-flight requests
    // instead, and also closes the window where stdin.destroyed has not flipped.
    stdin.on("error", (error) => this.fail(error));
    stdout.on("error", (error) => this.fail(error));
    this.child.stderr?.on("error", () => {});
  }

  /**
   * Send one request to the host and resolve with its validated JSON reply. The
   * host answers in FIFO order; `kind` tells the client which reply shape the
   * payload asks for, so the reply is validated as a well-formed `kind` reply
   * before it resolves. Rejects when the reply is not a valid `kind` reply,
   * when the host has already failed or exited, or if writing the request
   * fails.
   *
   * An abort before enqueueing affects only this call. Once enqueued, aborting
   * retires the whole FIFO because the reply stream has no request identifiers.
   * Serialization failure leaves the healthy host available for another call.
   * Payload serialization can invoke caller-defined conversion; exceptional
   * thrown values can also execute or fail conversion while being normalized.
   *
   * @evidence contracts/common.md#principled-implementation Each queued request carries its expected operation and resolves only from its own validated FIFO reply; cancellation after enqueueing retires the stream to prevent shifted reply ownership.
   * @evidence contracts/common.md#clear-and-simple-design Local serialization and pre-abort checks precede shared queue ownership; one settlement helper handles replies, cancellation and write failure with listener cleanup.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Cancellation does not remove a positional reply and continue under a false framing assumption; invalid replies cannot masquerade as missing files or rejected edits.
   * @evidence contracts/common.md#meaningful-documentation The separate lifecycle paragraph explains which failures affect one caller and which retire the shared host, applying the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Requests are JSON data written through the existing native pipe; filenames remain producer-owned values rather than command strings or assumed POSIX paths.
   * @evidence contracts/performance.md#efficient-algorithms Serialization visits supplied properties and encoded data, with caller-defined conversion costs not bounded by final JSON size. FIFO insertion and ordered settlement have amortized constant queue work; reply text parsing precedes fixed field checks, and host execution is delegated.
   * @evidence contracts/performance.md#reuse-equivalent-work File requests share the existing producer's committed transformation; effectful updates keep distinct ordered slots, and the client caches no response across producer state transitions.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Each pending call owns resolver callbacks and at most one abort listener; settlement removes the listener and queue reference, while cancellation retires every outstanding call. Live uncancelled work has no implicit timeout or queue cap.
   */
  public request(
    payload: Record<string, unknown>,
    kind: ResidentReplyKind,
    options: ResidentTransformRequestOptions = {},
  ): Promise<Record<string, unknown>> {
    if (this.failure !== undefined) {
      return Promise.reject(this.failure);
    }
    if (options.signal?.aborted) {
      return Promise.reject(cancelledError(options.signal));
    }
    const stdin = this.child.stdin;
    if (stdin === null || stdin.destroyed) {
      const error = new Error("ttsc: resident transform host stdin is closed");
      this.fail(error);
      return Promise.reject(error);
    }
    let line: string;
    try {
      line = `${JSON.stringify(payload)}\n`;
    } catch (error) {
      return Promise.reject(asError(error));
    }
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      let pending!: PendingRequest;
      pending = {
        kind,
        reject,
        resolve,
        settled: false,
        signal: options.signal,
      };
      if (options.signal !== undefined) {
        pending.abort = () => this.cancel(pending, options.signal!);
        options.signal.addEventListener("abort", pending.abort, { once: true });
      }
      this.pending.push(pending);
      if (options.signal?.aborted) {
        pending.abort!();
        return;
      }
      try {
        stdin.write(line, (error) => {
          if (error === null || error === undefined || pending.settled) {
            return;
          }
          this.settlePending(pending, error);
          this.fail(
            new Error(
              `ttsc: resident transform host could not write a request: ${error.message}`,
            ),
          );
        });
      } catch (error) {
        if (pending.settled) return;
        const reason = asError(error);
        this.settlePending(pending, reason);
        this.fail(
          new Error(
            `ttsc: resident transform host could not write a request: ${reason.message}`,
          ),
        );
      }
    });
  }

  /**
   * Retire the client, reject in-flight requests and attempt child termination.
   * Safe to call more than once; this void operation does not await child close
   * or prove OS signaling succeeded.
   *
   * @evidence contracts/common.md#principled-implementation Failure becomes terminal before all queued callers are rejected, so buffered lines cannot settle new callers after disposal.
   * @evidence contracts/common.md#clear-and-simple-design Disposal reuses the transport retirement path and preserves the child's real exit error when it has already died.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Cleanup uses supported child and stream APIs and rejects outstanding calls rather than synthesizing successful results. Destroy/signal attempts are not a child-close receipt or a guaranteed process-tree shutdown.
   * @evidence contracts/common.md#meaningful-documentation The native comment states caller-visible rejection and idempotence, following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Node destroys its own pipes and performs child signaling with its supported platform behavior; no process-tree shell command or signal assumption is imposed on callers.
   * @evidence contracts/performance.md#efficient-algorithms The queue is detached once and each outstanding request is settled once, making shutdown linear in pending population.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Disposal ends the shared producer rather than computing or validating a reusable result.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources Retirement removes all abort listeners, queue references and pipes; a single unreferenced grace timer attempts forced termination and is cleared on exit. OS failure to signal can still leave a running child.
   */
  public dispose(): void {
    if (this.failure !== undefined) return;
    // If the host already died, reject with its real exit error (stderr + exit
    // code) rather than a bland "disposed" message.
    this.fail(
      this.child.exitCode !== null || this.child.signalCode !== null
        ? this.exitError()
        : new Error("ttsc: resident transform host disposed"),
    );
  }

  private onLine(line: string): void {
    if (this.failure !== undefined) return;
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      return;
    }
    const request = this.pending[this.pendingHead];
    if (request === undefined) {
      // The host must emit exactly one reply per request, so an unmatched line
      // is a protocol violation that would desync every later reply into the
      // wrong request. Fail fast rather than silently returning wrong output.
      // A line arriving after teardown (failure already set) is benign.
      if (this.failure === undefined) {
        this.fail(
          new Error("ttsc: resident transform host sent an unsolicited reply"),
        );
      }
      return;
    }
    const reply = parseReplyObject(trimmed);
    if (reply === undefined) {
      // Framing violation: the line is not a JSON object, so it cannot
      // represent any reply. Reject this request and retire the whole process:
      // a bad line may be corruption that shifted
      // the stream, and the host's real reply that follows must not be paired
      // with a later request. `fail` marks the failure so that trailing line is
      // treated as benign instead of unsolicited.
      const error = new Error(
        `ttsc: resident transform host sent a malformed reply: ${echoLine(
          trimmed,
        )}`,
      );
      this.settlePending(request, error);
      this.fail(error);
      return;
    }
    if (!isValidReply(reply, request.kind)) {
      // Operation-shape violation: a well-formed JSON object that is not a valid
      // reply for the operation this request sent. FIFO framing is intact — one
      // line consumed exactly one slot — so only this request is corrupt; later
      // replies still pair correctly. Reject just this request instead of
      // failing the whole process.
      this.settlePending(
        request,
        new Error(
          `ttsc: resident transform host sent an invalid ${request.kind} reply: ${echoLine(
            trimmed,
          )}`,
        ),
      );
      return;
    }
    this.settlePending(request, reply);
  }

  private onReaderClose(): void {
    if (this.failure === undefined) this.fail(this.exitError());
  }

  private fail(error: Error): void {
    if (this.failure !== undefined) return;
    this.failure = error;
    this.rejectAll(error);
    this.terminate();
  }

  private rejectAll(error: Error): void {
    const pending = this.pending.splice(0);
    this.pendingHead = 0;
    for (const request of pending) {
      if (request !== undefined) this.settlePending(request, error);
    }
  }

  private settlePending(
    pending: PendingRequest,
    result: Error | Record<string, unknown>,
  ): void {
    if (pending.settled) return;
    pending.settled = true;
    if (this.pending[this.pendingHead] === pending) {
      this.pending[this.pendingHead++] = undefined;
      if (this.pendingHead * 2 >= this.pending.length) {
        this.pending.splice(0, this.pendingHead);
        this.pendingHead = 0;
      }
    }
    if (pending.signal !== undefined && pending.abort !== undefined) {
      pending.signal.removeEventListener("abort", pending.abort);
    }
    if (result instanceof Error) pending.reject(result);
    else pending.resolve(result);
  }

  private cancel(pending: PendingRequest, signal: AbortSignal): void {
    if (pending.settled) return;
    this.settlePending(pending, cancelledError(signal));
    this.fail(
      new Error(
        `ttsc: resident transform host retired after another request was cancelled${abortDetail(
          signal,
        )}${stderrSuffix(this.stderr)}`,
      ),
    );
  }

  private terminate(): void {
    this.reader.close();
    this.child.stdout?.destroy();
    this.child.stderr?.destroy();
    const stdin = this.child.stdin;
    if (stdin !== null && !stdin.destroyed) stdin.destroy();
    if (this.child.exitCode !== null || this.child.signalCode !== null) return;
    try {
      this.child.kill();
    } catch {
      // A failed cooperative signal does not cancel the forced attempt.
    }
    const force = setTimeout(() => {
      if (this.child.exitCode !== null || this.child.signalCode !== null) {
        return;
      }
      try {
        this.child.kill("SIGKILL");
      } catch {
        // The host exited between the liveness check and the forced signal.
      }
    }, TERMINATION_GRACE_MS);
    force.unref();
    this.child.once("exit", () => clearTimeout(force));
  }

  private exitError(): Error {
    const detail = this.stderr.trim();
    if (detail.length !== 0) {
      return new Error(detail);
    }
    // Read the child's own exit fields (set synchronously by Node) so the
    // message is accurate even before this instance's "exit" handler would run.
    const code = this.child.exitCode;
    const signalCode = this.child.signalCode;
    const signal = signalCode === null ? "" : `, signal ${signalCode}`;
    return new Error(
      `ttsc: resident transform host exited (code ${code ?? "null"}${signal})`,
    );
  }
}

/** Cap on retained stderr so a long-lived host cannot grow it without bound. */
const STDERR_TAIL_LIMIT = 64 * 1024;

/** Cap on how much of an offending line an error message echoes back. */
const REPLY_ECHO_LIMIT = 200;

/** Allow a cooperative host a short shutdown window before forcing it down. */
const TERMINATION_GRACE_MS = 1_000;

interface PendingRequest {
  abort?: () => void;
  kind: ResidentReplyKind;
  reject: (reason: Error) => void;
  resolve: (reply: Record<string, unknown>) => void;
  settled: boolean;
  signal?: AbortSignal;
}

function cancelledError(signal: AbortSignal): Error {
  const error = new Error(
    `ttsc: resident transform request cancelled${abortDetail(signal)}`,
  );
  error.name = "AbortError";
  return error;
}

function abortDetail(signal: AbortSignal): string {
  const reason = signal.reason;
  if (reason === undefined) return "";
  try {
    return `: ${reason instanceof Error ? reason.message : String(reason)}`;
  } catch {
    return "";
  }
}

function stderrSuffix(stderr: string): string {
  const detail = stderr.trim();
  return detail.length === 0 ? "" : `: ${detail}`;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * Parse one reply line into a plain object, or `undefined` when the line is not
 * a JSON object. Invalid JSON, arrays, primitives, and `null` all yield
 * `undefined`: none of them can carry a reply's fields, so the caller treats
 * them as a framing failure rather than an empty reply. Returning `{}` here
 * would let a corrupt line masquerade as a valid negative result.
 */
function parseReplyObject(line: string): Record<string, unknown> | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return undefined;
}

/**
 * Whether a parsed reply object is a well-formed reply for the given operation.
 * A transform reply must carry a boolean `found`, and when `found` is `true` a
 * string `typescript` (a found file always carries its transformed text); when
 * `found` is `false` the text is irrelevant. An update reply must carry a
 * boolean `updated`. Every other object shape is a protocol error.
 */
function isValidReply(
  reply: Record<string, unknown>,
  kind: ResidentReplyKind,
): boolean {
  if (kind === "transform") {
    if (typeof reply.found !== "boolean") {
      return false;
    }
    return reply.found ? typeof reply.typescript === "string" : true;
  }
  return typeof reply.updated === "boolean";
}

/** Truncate an offending reply line so error messages stay bounded. */
function echoLine(line: string): string {
  return line.length > REPLY_ECHO_LIMIT
    ? `${line.slice(0, REPLY_ECHO_LIMIT)}…`
    : line;
}
