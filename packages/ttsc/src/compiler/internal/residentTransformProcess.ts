import { type ChildProcess, spawn } from "node:child_process";
import { type Interface, createInterface } from "node:readline";

/** Cap on retained stderr so a long-lived host cannot grow it without bound. */
const STDERR_TAIL_LIMIT = 64 * 1024;

/** Options for spawning the resident transform host. */
export interface ResidentTransformProcessOptions {
  args: readonly string[];
  binary: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

interface PendingRequest {
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
   * Send one request to the host and resolve with its parsed JSON reply. The
   * host answers in FIFO order, so the caller interprets the reply shape by the
   * payload it sent (a transform reply vs an update reply). Rejects when the
   * host has already failed or exited, or if writing the request fails.
   */
  public request(
    payload: Record<string, unknown>,
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
      const pending: PendingRequest = { reject, resolve };
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
    request.resolve(parseReply(trimmed));
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
 * Parse one reply line into a plain object. A malformed line degrades to an
 * empty object rather than throwing, so one bad line never rejects a request
 * the FIFO has already advanced past; the caller reads missing fields as
 * absent.
 */
function parseReply(line: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(line) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // A non-object or unparseable line is treated as an empty reply.
  }
  return {};
}
