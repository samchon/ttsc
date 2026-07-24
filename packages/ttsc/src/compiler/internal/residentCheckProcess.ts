import { type ChildProcess, spawn } from "node:child_process";
import { type Interface, createInterface } from "node:readline";

import type { TtscBuildResult } from "../../structures/internal/TtscBuildResult";
import { normalizeRequestTimeoutMs } from "./residentTransformProcess";

const STDERR_TAIL_LIMIT = 64 * 1024;
const REPLY_ECHO_LIMIT = 200;
const TERMINATION_GRACE_MS = 1_000;

export interface ResidentCheckProcessOptions {
  args: readonly string[];
  binary: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  requestTimeoutMs?: number;
}

export interface ResidentCheckRequest {
  changed?: readonly string[];
  external?: readonly string[];
  invalidate?: boolean;
}

export interface ResidentCheckTelemetry {
  pid: number;
  programLoads: number;
  programUpdates: number;
  reused: boolean;
}

export type ResidentCheckResult = TtscBuildResult & {
  telemetry: ResidentCheckTelemetry;
};

type PendingRequest = {
  reject(reason: Error): void;
  resolve(result: ResidentCheckResult): void;
  timer: NodeJS.Timeout;
};

/**
 * FIFO JSON-line client for a check-stage `check-serve` sidecar.
 *
 * A watch session serializes cycles, but the client still queues replies so a
 * caller cannot accidentally pair a late response with the next request. Any
 * framing failure retires the process; the launcher then falls back to the
 * ordinary one-shot command for that cycle.
 */
export class ResidentCheckProcess {
  private readonly child: ChildProcess;
  private readonly pending: PendingRequest[] = [];
  private readonly reader: Interface;
  private readonly requestTimeoutMs: number;
  private failure: Error | undefined;
  private stderr = "";

  public constructor(options: ResidentCheckProcessOptions) {
    this.requestTimeoutMs = normalizeRequestTimeoutMs(options.requestTimeoutMs);
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

  public request(payload: ResidentCheckRequest): Promise<ResidentCheckResult> {
    if (this.failure !== undefined) return Promise.reject(this.failure);
    const stdin = this.child.stdin;
    if (stdin === null || stdin.destroyed) {
      return Promise.reject(
        new Error("ttsc: resident check host stdin is closed"),
      );
    }
    let line: string;
    try {
      line = `${JSON.stringify(payload)}\n`;
    } catch (error) {
      return Promise.reject(asError(error));
    }
    return new Promise<ResidentCheckResult>((resolve, reject) => {
      const pending: PendingRequest = {
        reject,
        resolve,
        timer: setTimeout(() => {
          const detail = stderrSuffix(this.stderr);
          const timeout = new Error(
            `ttsc: resident check request timed out after ${String(
              this.requestTimeoutMs,
            )} ms${detail}`,
          );
          this.settle(pending, timeout);
          this.fail(timeout);
        }, this.requestTimeoutMs),
      };
      pending.timer.unref();
      this.pending.push(pending);
      try {
        stdin.write(line, (error) => {
          if (error === null || error === undefined) return;
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

  public dispose(): void {
    if (this.failure !== undefined) return;
    this.fail(new Error("ttsc: resident check host disposed"));
  }

  private onLine(line: string): void {
    if (this.failure !== undefined || line.trim().length === 0) return;
    const pending = this.pending[0];
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
    const index = this.pending.indexOf(pending);
    if (index === -1) return;
    this.pending.splice(index, 1);
    clearTimeout(pending.timer);
    if (result instanceof Error) pending.reject(result);
    else pending.resolve(result);
  }

  private fail(error: Error): void {
    if (this.failure !== undefined) return;
    this.failure = error;
    while (this.pending.length !== 0) {
      this.settle(this.pending[0]!, error);
    }
    this.terminate();
  }

  private terminate(): void {
    const stdin = this.child.stdin;
    if (stdin !== null && !stdin.destroyed) stdin.destroy();
    if (this.child.exitCode !== null || this.child.signalCode !== null) return;
    try {
      this.child.kill();
    } catch {
      return;
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

function stderrSuffix(stderr: string): string {
  const detail = stderr.trim();
  return detail.length === 0 ? "" : `: ${detail}`;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
