import { type ChildProcess, spawn } from "node:child_process";
import { type Interface, createInterface } from "node:readline";

/** Cap on retained stderr so a long-lived host cannot grow it without bound. */
const STDERR_TAIL_LIMIT = 64 * 1024;

/** Cap on how much of an offending line an error message echoes back. */
const REPLY_ECHO_LIMIT = 200;

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
}

interface PendingRequest {
  kind: ResidentReplyKind;
  reject: (reason: Error) => void;
  resolve: (reply: Record<string, unknown>) => void;
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
  private stderr = "";
  private failure: Error | undefined;

  public constructor(options: ResidentTransformProcessOptions) {
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
  ): Promise<Record<string, unknown>> {
    if (this.failure !== undefined) {
      return Promise.reject(this.failure);
    }
    const stdin = this.child.stdin;
    if (stdin === null || stdin.destroyed) {
      return Promise.reject(
        new Error("ttsc: resident transform host stdin is closed"),
      );
    }
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const pending: PendingRequest = { kind, reject, resolve };
      this.pending.push(pending);
      stdin.write(`${JSON.stringify(payload)}\n`, (error) => {
        if (error) {
          this.removePending(pending);
          reject(error);
        }
      });
    });
  }

  /**
   * Terminate the resident process and reject any in-flight requests. Safe to
   * call more than once.
   */
  public dispose(): void {
    if (this.failure === undefined) {
      // If the host already died, reject with its real exit error (stderr +
      // exit code) rather than a bland "disposed" message.
      this.failure =
        this.child.exitCode !== null || this.child.signalCode !== null
          ? this.exitError()
          : new Error("ttsc: resident transform host disposed");
    }
    const stdin = this.child.stdin;
    if (stdin !== null && !stdin.destroyed) {
      stdin.end();
    }
    this.reader.close();
    this.rejectAll(this.failure);
    if (this.child.exitCode === null && this.child.signalCode === null) {
      this.child.kill();
    }
  }

  private onLine(line: string): void {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      return;
    }
    const request = this.pending.shift();
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
      request.reject(error);
      this.fail(error);
      return;
    }
    if (!isValidReply(reply, request.kind)) {
      // Operation-shape violation: a well-formed JSON object that is not a valid
      // reply for the operation this request sent. FIFO framing is intact — one
      // line consumed exactly one slot — so only this request is corrupt; later
      // replies still pair correctly. Reject just this request instead of
      // failing the whole process.
      request.reject(
        new Error(
          `ttsc: resident transform host sent an invalid ${request.kind} reply: ${echoLine(
            trimmed,
          )}`,
        ),
      );
      return;
    }
    request.resolve(reply);
  }

  private onReaderClose(): void {
    if (this.pending.length === 0) {
      return;
    }
    this.rejectAll(this.failure ?? this.exitError());
  }

  private fail(error: Error): void {
    this.failure ??= error;
    this.rejectAll(this.failure);
  }

  private rejectAll(error: Error): void {
    while (this.pending.length !== 0) {
      this.pending.shift()!.reject(error);
    }
  }

  private removePending(target: PendingRequest): void {
    const index = this.pending.indexOf(target);
    if (index !== -1) {
      this.pending.splice(index, 1);
    }
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
