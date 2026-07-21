import { type ChildProcess, spawn } from "node:child_process";
import { type Interface, createInterface } from "node:readline";

/** Cap on retained stderr so a long-lived host cannot grow it without bound. */
const STDERR_TAIL_LIMIT = 64 * 1024;

/** Cap on how much of an offending line an error message echoes back. */
const REPLY_ECHO_LIMIT = 200;

/** Default deadline for one request to the resident transform host. */
const DEFAULT_REQUEST_TIMEOUT_MS = 300_000;

/** Node clamps timers beyond this signed 32-bit millisecond duration. */
const MAX_TIMER_MS = 2_147_483_647;

/** Allow a cooperative host a short shutdown window before forcing it down. */
const TERMINATION_GRACE_MS = 1_000;

/**
 * The operation a request expects a reply for. The host answers a transform
 * request (`{"file":...}`) with `{"typescript":...,"found":...}` and an update
 * request (`{"update":...,"content":...}`) with `{"updated":...}`. The client
 * knows which it sent, so it validates the reply's shape against the operation
 * before handing it back — a well-formed JSON object of the wrong operation
 * shape is a protocol error, not a valid negative result.
 */
export type ResidentReplyKind = "transform" | "update";

/** Options for spawning the resident transform host. */
export interface ResidentTransformProcessOptions {
  args: readonly string[];
  binary: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** Maximum time one request may wait for the resident host's reply. */
  requestTimeoutMs?: number;
}

/** Per-request lifecycle controls for a resident transform host. */
export interface ResidentTransformRequestOptions {
  /** Abort this request. An in-flight abort retires the FIFO host. */
  signal?: AbortSignal;
}

interface PendingRequest {
  abort?: () => void;
  kind: ResidentReplyKind;
  reject: (reason: Error) => void;
  resolve: (reply: Record<string, unknown>) => void;
  settled: boolean;
  signal?: AbortSignal;
  timer: NodeJS.Timeout;
}

/**
 * Async client for the long-lived `utility-host serve` process.
 *
 * The host transforms the whole project once at startup, caches every file's
 * transformed TypeScript, then answers newline-delimited requests. This class
 * speaks that protocol: each {@link request} writes one JSON line and the host
 * replies with one line, matched FIFO. A transform request (`{"file":...}`) is
 * answered with `{"typescript":...,"found":...}`, and an update request
 * (`{"update":...,"content":...}`) with `{"updated":...}`.
 *
 * One resident process answers every request from one service instead of
 * spawning a fresh `transform` subprocess per call, so a single process pays
 * the project compile once (samchon/ttsc#255).
 */
export class ResidentTransformProcess {
  private readonly child: ChildProcess;
  private readonly reader: Interface;
  private readonly pending: PendingRequest[] = [];
  private readonly requestTimeoutMs: number;
  private stderr = "";
  private failure: Error | undefined;

  public constructor(options: ResidentTransformProcessOptions) {
    this.requestTimeoutMs = normalizeRequestTimeoutMs(options.requestTimeoutMs);
    // Default stdio is "pipe" for stdin/stdout/stderr, which is exactly what the
    // line protocol needs; spelling it out as a string[] would not narrow to
    // StdioOptions, so it is left implicit.
    this.child = spawn(options.binary, [...options.args], {
      cwd: options.cwd,
      env: options.env,
      windowsHide: true,
    });
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
      return Promise.reject(
        new Error("ttsc: resident transform host stdin is closed"),
      );
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
        timer: setTimeout(() => this.timeout(pending), this.requestTimeoutMs),
      };
      pending.timer.unref();
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
   * Terminate the resident process and reject any in-flight requests. Safe to
   * call more than once.
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
    const request = this.pending[0];
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
      // represent any reply. This request already left the FIFO, so reject it,
      // then fail the whole process: a bad line may be corruption that shifted
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
    while (this.pending.length !== 0) {
      this.settlePending(this.pending[0]!, error);
    }
  }

  private settlePending(
    pending: PendingRequest,
    result: Error | Record<string, unknown>,
  ): void {
    if (pending.settled) return;
    pending.settled = true;
    const index = this.pending.indexOf(pending);
    if (index !== -1) this.pending.splice(index, 1);
    clearTimeout(pending.timer);
    if (pending.signal !== undefined && pending.abort !== undefined) {
      pending.signal.removeEventListener("abort", pending.abort);
    }
    if (result instanceof Error) pending.reject(result);
    else pending.resolve(result);
  }

  private timeout(pending: PendingRequest): void {
    if (pending.settled) return;
    const timeout = new Error(
      `ttsc: resident transform request timed out after ${String(
        this.requestTimeoutMs,
      )} ms${stderrSuffix(this.stderr)}`,
    );
    this.settlePending(pending, timeout);
    this.fail(
      new Error(
        `ttsc: resident transform host retired after another request timed out${stderrSuffix(
          this.stderr,
        )}`,
      ),
    );
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
    const stdin = this.child.stdin;
    if (stdin !== null && !stdin.destroyed) stdin.destroy();
    if (this.child.exitCode !== null || this.child.signalCode !== null) return;
    try {
      this.child.kill();
    } catch {
      // The host exited between the liveness check and termination.
      return;
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

/** Validate and normalize the caller-visible resident request deadline. */
export function normalizeRequestTimeoutMs(requestTimeoutMs?: number): number {
  const value = requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_TIMER_MS) {
    throw new TypeError(
      `ttsc: requestTimeoutMs must be an integer between 1 and ${String(MAX_TIMER_MS)}`,
    );
  }
  return value;
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
