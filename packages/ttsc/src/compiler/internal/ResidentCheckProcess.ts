import { type ChildProcess, spawn } from "node:child_process";
import { type Interface, createInterface } from "node:readline";

import type { ResidentCheckProcessOptions } from "./ResidentCheckProcessOptions";
import type { ResidentCheckRequest } from "./ResidentCheckRequest";
import type { ResidentCheckResult } from "./ResidentCheckResult";

/**
 * FIFO JSON-line client for a check-stage `check-serve` sidecar.
 *
 * A watch session serializes cycles, but the client still queues replies so a
 * caller cannot accidentally pair a late response with the next request. Any
 * framing failure retires the process; the launcher then falls back to the
 * ordinary one-shot command for that cycle.
 *
 * The caller owns disposal. Requests have no deadline, and outstanding request
 * count and reply-line size are not capped; a slow live check remains pending.
 * Retirement ends stdin and waits for actual close. A one-second grace period
 * starts after stdin finishes, followed by forced termination and a one-second
 * join deadline. Pending stdin writes have a one-second flush deadline once
 * the retiring call stack yields. An unjoined deadline releases this client's
 * pipes, listeners, timers and process reference while keeping joining failed;
 * it neither kills unrelated descendants nor certifies their termination.
 * A forced or unjoined process is not a graceful shutdown.
 *
 * @evidence contracts/common.md#principled-implementation One positional reply consumes one queued cycle; invalid framing or shape retires the stream so a delayed reply cannot answer a different cycle.
 * @evidence contracts/common.md#clear-and-simple-design One client owns its child, line reader, FIFO and failure state; private parsing and settlement keep transport policy separate from the watch coordinator's fallback.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Protocol validation uses the declared reply fields, and transport failure is rejection rather than a fabricated successful check or a consumer-specific recovery.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain FIFO ownership, retirement, caller disposal and the absence of request bounds, following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Node spawns the supplied native executable with an argv array and pipe streams, without shell quoting; cwd and environment retain caller-provided native semantics.
 * @evidence contracts/performance.md#efficient-algorithms A head cursor consumes replies in constant amortized queue work; prefix compaction costs no more than the consumed population, and failure drains outstanding requests once.
 * @evidence contracts/performance.md#reuse-equivalent-work One fixed-configuration child retains its Program across FIFO cycles; changed and external paths travel with each request, while the watch owner replaces the process when configuration or plugin identity changes.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Each settled slot releases its request; retirement clears the queue and drains replies until actual close or the failed join deadline. That deadline releases owned transport handles and callbacks without claiming the physical child or unrelated descendants joined; live request count and line bytes have no fixed cap.
 */
export class ResidentCheckProcess {
  private readonly child: ChildProcess;
  private readonly pending: (PendingRequest | undefined)[] = [];
  private pendingHead = 0;
  private readonly reader: Interface;
  private failure: Error | undefined;
  private stderr = "";
  private readonly exited: Promise<void>;
  private closing = false;
  private didClose = false;
  private forced = false;
  private flushDeadline: NodeJS.Timeout | undefined;
  private terminationTimer: NodeJS.Timeout | undefined;
  private terminationDeadline: NodeJS.Timeout | undefined;
  private releaseTransport: (() => void) | undefined;

  public constructor(options: ResidentCheckProcessOptions) {
    this.child = spawn(options.binary, [...options.args], {
      cwd: options.cwd,
      env: options.env,
      windowsHide: true,
    });
    let onChildClose: (() => void) | undefined;
    this.exited = new Promise<void>((resolve, reject) => {
      onChildClose = () => {
        this.didClose = true;
        clearTimeout(this.flushDeadline);
        clearTimeout(this.terminationTimer);
        clearTimeout(this.terminationDeadline);
        this.releaseTransport = undefined;
        this.reader?.close();
        resolve();
      };
      this.child.once("close", onChildClose);
      this.rejectExit = reject;
    });
    // Legacy dispose initiates retirement without returning a promise. Keep its
    // rejected join observable to awaiters without an unhandled rejection.
    void this.exited.catch(() => {});
    const stdin = this.child.stdin;
    const stdout = this.child.stdout;
    if (stdin === null || stdout === null) {
      this.child.kill();
      throw new Error("ttsc: resident check host has no stdio pipes");
    }
    this.reader = createInterface({ input: stdout });
    const onLine = (line: string) => this.onLine(line);
    const onReaderClose = () => {
      if (this.failure === undefined) this.fail(this.exitError());
    };
    const onStderr = (chunk: Buffer | string) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      this.stderr = (this.stderr + text).slice(-STDERR_TAIL_LIMIT);
    };
    const onError = (error: Error) => this.fail(error);
    this.reader.on("line", onLine);
    this.reader.on("close", onReaderClose);
    this.child.stderr?.on("data", onStderr);
    this.child.on("error", onError);
    stdin.on("error", onError);
    stdout.on("error", onError);
    this.child.stderr?.on("error", ResidentCheckProcess.ignoreTransportError);
    this.releaseTransport = () => {
      clearTimeout(this.flushDeadline);
      clearTimeout(this.terminationTimer);
      clearTimeout(this.terminationDeadline);
      this.reader.off("line", onLine);
      this.reader.off("close", onReaderClose);
      this.reader.close();
      if (onChildClose !== undefined) this.child.off("close", onChildClose);
      this.child.off("error", onError);
      this.child.on("error", ResidentCheckProcess.ignoreTransportError);
      this.child.stderr?.off("data", onStderr);
      for (const stream of [stdin, stdout, this.child.stderr]) {
        stream?.off("error", onError);
        stream?.off("error", ResidentCheckProcess.ignoreTransportError);
        stream?.on("error", ResidentCheckProcess.ignoreTransportError);
        stream?.destroy();
      }
      this.child.unref();
    };
  }

  /**
   * Send one watch cycle and wait for its reply.
   *
   * Replies are paired with requests in FIFO order. A request made after the
   * process failed, or whose line cannot be written, rejects with the failure
   * that retired the process, so the caller can fall back to a one-shot check
   * for that cycle.
   *
   * Serialization errors reject only this call before it enters the stream. A
   * closed input retires the shared host and rejects its other pending calls.
   *
   * @evidence contracts/common.md#principled-implementation Serialization precedes enqueueing, and each successfully enqueued call keeps its own FIFO slot until a validated reply or shared retirement settles it.
   * @evidence contracts/common.md#clear-and-simple-design Pre-write validation remains local; write failures use the same settlement and retirement operations as pipe and protocol failure.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed serialization cannot consume a reply slot, and a closed pipe is not treated as a healthy host with one exceptional caller.
   * @evidence contracts/common.md#meaningful-documentation Separate paragraphs document reply ordering, rejection scope and closed-input effects, applying the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation JSON lines pass native change paths as data over Node's stdin stream, without constructing a shell command or converting native separators.
   * @evidence contracts/performance.md#efficient-algorithms Encoding costs the payload's serialized size, enqueueing is constant time, and reply settlement is amortized constant queue work plus parsing the reply bytes.
   * @evidence contracts/performance.md#reuse-equivalent-work Each cycle is sent to the existing fixed-configuration Program owner; changes are effectful transitions and are not coalesced merely because request values match.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The client retains one resolver pair per outstanding call until reply or retirement; serialization allocates one request line, and live requests wait without an implicit timeout or population limit.
   */
  public request(payload: ResidentCheckRequest): Promise<ResidentCheckResult> {
    if (this.failure !== undefined) return Promise.reject(this.failure);
    const stdin = this.child.stdin;
    if (stdin === null || stdin.destroyed) {
      const error = new Error("ttsc: resident check host stdin is closed");
      this.fail(error);
      return Promise.reject(error);
    }
    let line: string;
    try {
      line = `${JSON.stringify(payload)}\n`;
    } catch (error) {
      return Promise.reject(asError(error));
    }
    return new Promise<ResidentCheckResult>((resolve, reject) => {
      const pending: PendingRequest = { reject, resolve, settled: false };
      this.pending.push(pending);
      try {
        stdin.write(line, (error) => {
          if (error === null || error === undefined || pending.settled) return;
          this.settle(pending, error);
          this.fail(error);
        });
      } catch (error) {
        const reason = asError(error);
        this.settle(pending, reason);
        this.fail(reason);
      }
    });
  }

  /**
   * Retire the sidecar: reject pending requests and close its request stream.
   * Idempotent; a process that already failed is left as is.
   *
   * @evidence contracts/common.md#principled-implementation Setting failure before rejecting the detached FIFO makes disposal terminal; subsequent replies and requests cannot revive the child.
   * @evidence contracts/common.md#clear-and-simple-design Disposal enters the same retirement path as transport failure instead of maintaining a second cleanup sequence.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Cleanup ends the actual owned streams and attempts child termination; it does not disguise a pending request as a successful result.
   * @evidence contracts/common.md#meaningful-documentation The native comment states terminal rejection and repeated-call behavior, following the documentation skill's ownership guidance.
   * @evidence contracts/portability.md#os-neutral-implementation Owned stream EOF and forced signaling use Node's supported APIs without shell or POSIX process-tree commands.
   * @evidence contracts/performance.md#efficient-algorithms Retirement visits each outstanding request once and releases the queue in linear time rather than repeatedly shifting all remaining entries.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Disposal ends the owner and produces no computation that another request may reuse.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources Disposal clears pending callbacks and sends EOF while draining replies until actual close or a failed bounded join; the failed deadline releases this client's handles without signalling unrelated descendants or reporting graceful completion.
   */
  public dispose(): void {
    this.fail(new Error("ttsc: resident check host disposed"));
  }

  /**
   * End the request stream and await the owned child's actual close event.
   * A forced, signalled or nonzero exit rejects; repeated calls share retirement.
   *
   * @evidence contracts/common.md#principled-implementation EOF is sent on the owned input and success requires the child's actual close with status zero, never merely a successful kill request.
   * @evidence contracts/common.md#clear-and-simple-design Retirement and join are shared with dispose; this awaitable boundary adds exit validation for callers that must release process ownership.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Forced and unknown termination remain failures rather than fabricated graceful completion.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the child-close authority, success condition and repeated-call behavior.
   * @evidence contracts/portability.md#os-neutral-implementation Native stdin EOF and child close events work through Node's process API; forced signalling is a failure rather than a portable graceful-stop assumption.
   * @evidence contracts/performance.md#efficient-algorithms Closing performs one retirement traversal and constant-time exit validation; no polling population grows over the lifetime.
   * @evidence contracts/performance.md#reuse-equivalent-work Repeated closes reuse the single actual-exit promise but never reuse an earlier process's exit as proof for another child.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Actual close clears termination timers; a failed bounded join releases this client's transport and process reference while remaining a terminal failure, independent of later physical child or descendant termination.
   */
  public async close(): Promise<void> {
    this.dispose();
    await this.exited;
    if (this.forced)
      throw new Error("ttsc: resident check host required forced termination");
    if (this.child.exitCode !== 0 || this.child.signalCode !== null)
      throw this.exitError();
  }

  /**
   * Await actual retirement before a transport-failure fallback starts.
   * A known failed child may be replaced; an unjoined child may not.
   *
   * @evidence contracts/common.md#principled-implementation A replacement can start only after the original child's close event releases its native ownership.
   * @evidence contracts/common.md#clear-and-simple-design The transport owner exposes joining separately from graceful status validation for the supported recovery policy.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts An elapsed deadline rejects instead of treating a still-live process as retired.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes recovery's known failed exit from shutdown's graceful success requirement.
   * @evidence contracts/portability.md#os-neutral-implementation The actual close event, rather than a signal result or native PID spelling, establishes retirement on each platform.
   * @evidence contracts/performance.md#efficient-algorithms Joining adds one promise subscription and no filesystem or process polling.
   * @evidence contracts/performance.md#reuse-equivalent-work Every waiter shares this child's terminal event; a replacement always owns a new promise.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Waiters settle on close or the bounded termination deadline; an unknown live owner remains failure.
   */
  public waitForExit(): Promise<void> {
    return this.exited;
  }

  private rejectExit: ((error: Error) => void) | undefined;

  private onLine(line: string): void {
    if (this.failure !== undefined || line.trim().length === 0) return;
    const pending = this.pending[this.pendingHead];
    if (pending === undefined) {
      this.fail(
        new Error("ttsc: resident check host sent an unsolicited reply"),
      );
      return;
    }
    const result = parseResidentCheckResult(line);
    if (result === undefined) {
      const error = new Error(
        `ttsc: resident check host sent a malformed reply: ${echoLine(line)}`,
      );
      this.settle(pending, error);
      this.fail(error);
      return;
    }
    this.settle(pending, result);
  }

  private settle(
    pending: PendingRequest,
    result: Error | ResidentCheckResult,
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
    if (result instanceof Error) pending.reject(result);
    else pending.resolve(result);
  }

  private fail(error: Error): void {
    if (this.failure !== undefined) return;
    this.failure = error;
    const pending = this.pending.splice(0);
    this.pendingHead = 0;
    for (const request of pending) {
      if (request !== undefined) this.settle(request, error);
    }
    this.terminate();
  }

  private terminate(): void {
    if (this.closing) return;
    this.closing = true;
    const stdin = this.child.stdin;
    if (stdin !== null && !stdin.destroyed) {
      try {
        // EOF cannot reach the child until the owned writable pipe finishes.
        // A blocked parent event loop must not spend the child's shutdown grace
        // before that delivery can happen.
        stdin.end(() => this.startTerminationGrace());
        // Start delivery's own deadline after the caller gives Node control.
        // This bounds an unread full pipe without charging synchronous caller
        // work against either delivery or the child's later EOF grace.
        queueMicrotask(() => {
          if (this.didClose || this.terminationTimer !== undefined) return;
          this.flushDeadline = setTimeout(
            () => this.forceTerminationAndJoin(),
            TERMINATION_GRACE_MS,
          );
        });
        return;
      } catch {
        stdin.destroy();
      }
    }
    this.startTerminationGrace();
  }

  private startTerminationGrace(): void {
    clearTimeout(this.flushDeadline);
    // Keep output pipes readable until close: destroying them would discard the
    // last reply and confuse a requested EOF with transport truncation.
    if (this.didClose || this.terminationTimer !== undefined || this.terminationDeadline !== undefined) return;
    this.terminationTimer = setTimeout(
      () => this.forceTerminationAndJoin(),
      TERMINATION_GRACE_MS,
    );
  }

  private forceTerminationAndJoin(): void {
    if (this.didClose || this.terminationDeadline !== undefined) return;
    if (this.child.exitCode === null && this.child.signalCode === null) {
      this.forced = true;
      try {
        this.child.kill("SIGKILL");
      } catch {
        // The deadline still requires actual close, even if kill fails.
      }
    }
    this.terminationDeadline = setTimeout(() => {
      this.rejectExit?.(
        new Error("ttsc: resident check host did not close after termination"),
      );
      // Reject first: destroying inherited pipes can cause Node's close event,
      // but releasing our handles cannot prove a graceful physical join.
      this.releaseTransport?.();
      this.releaseTransport = undefined;
    }, TERMINATION_GRACE_MS);
  }

  private static ignoreTransportError(): void {}

  private exitError(): Error {
    const detail = this.stderr.trim();
    if (detail.length !== 0) return new Error(detail);
    const signal =
      this.child.signalCode === null ? "" : `, signal ${this.child.signalCode}`;
    return new Error(
      `ttsc: resident check host exited (code ${
        this.child.exitCode ?? "null"
      }${signal})`,
    );
  }
}

const STDERR_TAIL_LIMIT = 64 * 1024;

const REPLY_ECHO_LIMIT = 200;

const TERMINATION_GRACE_MS = 1_000;

type PendingRequest = {
  reject(reason: Error): void;
  resolve(result: ResidentCheckResult): void;
  settled: boolean;
};
function parseResidentCheckResult(
  line: string,
): ResidentCheckResult | undefined {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (
    !isRecord(value) ||
    typeof value.status !== "number" ||
    !Number.isInteger(value.status)
  ) {
    return undefined;
  }
  if (typeof value.stdout !== "string" || typeof value.stderr !== "string") {
    return undefined;
  }
  const telemetry = value.telemetry;
  if (
    !isRecord(telemetry) ||
    typeof telemetry.pid !== "number" ||
    !Number.isSafeInteger(telemetry.pid) ||
    typeof telemetry.programLoads !== "number" ||
    !Number.isSafeInteger(telemetry.programLoads) ||
    typeof telemetry.programUpdates !== "number" ||
    !Number.isSafeInteger(telemetry.programUpdates) ||
    typeof telemetry.reused !== "boolean"
  ) {
    return undefined;
  }
  return {
    diagnostics: [],
    status: value.status,
    stderr: value.stderr,
    stdout: value.stdout,
    telemetry: {
      pid: telemetry.pid,
      programLoads: telemetry.programLoads,
      programUpdates: telemetry.programUpdates,
      reused: telemetry.reused,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function echoLine(line: string): string {
  const trimmed = line.trim();
  return JSON.stringify(
    trimmed.length <= REPLY_ECHO_LIMIT
      ? trimmed
      : `${trimmed.slice(0, REPLY_ECHO_LIMIT)}…`,
  );
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
