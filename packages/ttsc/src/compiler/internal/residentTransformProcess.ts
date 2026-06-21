import { type ChildProcess, spawn } from "node:child_process";
import { createInterface, type Interface } from "node:readline";

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
 * transformed TypeScript, then answers newline-delimited per-file requests. This
 * class speaks that protocol: each {@link transformFile} writes one
 * `{"file":...}` line and the host replies with one
 * `{"typescript":...,"found":...}` line. The host answers in FIFO order, so
 * replies are matched to a queue of pending requests.
 *
 * One resident process replaces the per-call `transform` subprocess every Metro
 * worker would otherwise spawn, which is the cross-worker recompile this removes
 * (samchon/ttsc#255).
 */
export class ResidentTransformProcess {
  private readonly child: ChildProcess;
  private readonly reader: Interface;
  private readonly pending: PendingRequest[] = [];
  private stderr = "";
  private exitCode: number | null = null;
  private exitSignal: NodeJS.Signals | null = null;
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
    if (stdout === null || this.child.stdin === null) {
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
      this.stderr += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    });
    this.child.on("error", (error) => this.fail(error));
    this.child.on("exit", (code, signal) => {
      this.exitCode = code;
      this.exitSignal = signal;
    });
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
    this.failure ??= new Error("ttsc: resident transform host disposed");
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
      return; // unsolicited line; nothing is waiting for it
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
    const signal = this.exitSignal === null ? "" : `, signal ${this.exitSignal}`;
    return new Error(
      `ttsc: resident transform host exited (code ${this.exitCode ?? "null"}${signal})`,
    );
  }
}

/**
 * Parse one reply line into a plain object. A malformed line degrades to an
 * empty object rather than throwing, so one bad line never rejects a request the
 * FIFO has already advanced past; the caller reads missing fields as absent.
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
