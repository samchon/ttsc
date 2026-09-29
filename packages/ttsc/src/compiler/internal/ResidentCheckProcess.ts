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
 *
 * @evidence contracts/common.md#principled-implementation One positional reply consumes one queued cycle; invalid framing or shape retires the stream so a delayed reply cannot answer a different cycle.
 * @evidence contracts/common.md#clear-and-simple-design One client owns its child, line reader, FIFO and failure state; private parsing and settlement keep transport policy separate from the watch coordinator's fallback.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Protocol validation uses the declared reply fields, and transport failure is rejection rather than a fabricated successful check or a consumer-specific recovery.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain FIFO ownership, retirement, caller disposal and the absence of request bounds, following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Node spawns the supplied native executable with an argv array and pipe streams, without shell quoting; cwd and environment retain caller-provided native semantics.
 * @evidence contracts/performance.md#efficient-algorithms A head cursor consumes replies in constant amortized queue work; prefix compaction costs no more than the consumed population, and failure drains outstanding requests once.
 * @evidence contracts/performance.md#reuse-equivalent-work One fixed-configuration child retains its Program across FIFO cycles; changed and external paths travel with each request, while the watch owner replaces the process when configuration or plugin identity changes.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Each settled slot releases its request, retirement clears the queue and closes pipes, and termination has a forced attempt after its grace period. Outstanding requests and line bytes have no fixed cap, and OS-denied termination can leave a live child.
 */
export class ResidentCheckProcess {
  private readonly child: ChildProcess;
  private readonly pending: (PendingRequest | undefined)[] = [];
  private pendingHead = 0;
  private readonly reader: Interface;
  private failure: Error | undefined;
  private stderr = "";

  public constructor(options: ResidentCheckProcessOptions) {
    this.child = spawn(options.binary, [...options.args], {
      cwd: options.cwd,
      env: options.env,
      windowsHide: true,
    });
    const stdin = this.child.stdin;
    const stdout = this.child.stdout;
    if (stdin === null || stdout === null) {
      this.child.kill();
      throw new Error("ttsc: resident check host has no stdio pipes");
    }
    this.reader = createInterface({ input: stdout });
    this.reader.on("line", (line) => this.onLine(line));
    this.reader.on("close", () => {
      if (this.failure === undefined) this.fail(this.exitError());
    });
    this.child.stderr?.on("data", (chunk: Buffer | string) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      this.stderr = (this.stderr + text).slice(-STDERR_TAIL_LIMIT);
    });
    this.child.on("error", (error) => this.fail(error));
    stdin.on("error", (error) => this.fail(error));
    stdout.on("error", (error) => this.fail(error));
    this.child.stderr?.on("error", () => {});
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
   * Retire the sidecar: reject every pending request and terminate the process.
   * Idempotent; a process that already failed is left as is.
   *
   * @evidence contracts/common.md#principled-implementation Setting failure before rejecting the detached FIFO makes disposal terminal; subsequent replies and requests cannot revive the child.
   * @evidence contracts/common.md#clear-and-simple-design Disposal enters the same retirement path as transport failure instead of maintaining a second cleanup sequence.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Cleanup ends the actual owned streams and attempts child termination; it does not disguise a pending request as a successful result.
   * @evidence contracts/common.md#meaningful-documentation The native comment states terminal rejection and repeated-call behavior, following the documentation skill's ownership guidance.
   * @evidence contracts/portability.md#os-neutral-implementation Stream destruction and child signaling use Node's supported APIs; the forced signal follows Node's platform behavior rather than shell or POSIX process-tree commands.
   * @evidence contracts/performance.md#efficient-algorithms Retirement visits each outstanding request once and releases the queue in linear time rather than repeatedly shifting all remaining entries.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Disposal ends the owner and produces no computation that another request may reuse.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources Disposal closes the reader and all owned pipes, clears pending callbacks and schedules at most one unreferenced forced-termination timer; child exit clears that timer, while signaling errors cannot guarantee process death.
   */
  public dispose(): void {
    if (this.failure !== undefined) return;
    this.fail(new Error("ttsc: resident check host disposed"));
  }

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
      if (this.child.exitCode !== null || this.child.signalCode !== null)
        return;
      try {
        this.child.kill("SIGKILL");
      } catch {
        // The host exited between the liveness check and forced termination.
      }
    }, TERMINATION_GRACE_MS);
    force.unref();
    this.child.once("exit", () => clearTimeout(force));
  }

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
