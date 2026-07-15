import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import readline from "node:readline";
import typia from "typia";

import { ensureExecutable } from "../nativeExecutable";
import { resolveGraphBinary } from "../resolveGraphBinary";
import { ITtscGraphDump } from "../structures/ITtscGraphDump";
import { TtscGraphMemory } from "./TtscGraphMemory";

interface SessionResponse {
  id: number;
  changed: boolean;
  mode?: "initial" | "unchanged" | "incremental" | "rebuild" | "reload";
  dump?: unknown;
  error?: string;
}

interface Pending {
  resolve: (response: SessionResponse) => void;
  reject: (error: Error) => void;
}

/**
 * Resident bridge to `ttscgraph serve`.
 *
 * Every graph request first asks the native session for the current disk
 * snapshot. Unchanged requests reuse the existing {@link TtscGraphMemory}; an
 * edited source reuses tsgo's resident Program through `driver.Session`, while
 * config and root-file-set changes force a safe full reload.
 */
export class TtscGraphSession {
  private readonly cwd: string;
  private readonly tsconfig: string;
  private readonly binary: string;
  private child: ChildProcessWithoutNullStreams | undefined;
  private stderr = "";
  private nextId = 0;
  private readonly pending = new Map<number, Pending>();
  private queue: Promise<void> = Promise.resolve();
  private current: TtscGraphMemory | undefined;
  private closed = false;

  public constructor(options: {
    cwd: string;
    tsconfig: string;
    binary?: string;
  }) {
    // Resolve the platform binary from the project this session serves, so the
    // MCP server started from an unrelated directory still finds the target's
    // installed `ttsc`.
    const binary =
      options.binary ?? resolveGraphBinary(process.env, options.cwd);
    if (binary === null) {
      throw new Error(
        "@ttsc/graph: could not resolve the ttscgraph binary. " +
          "Install `ttsc` so its platform package is present, " +
          "or set TTSC_GRAPH_BINARY to an absolute path.",
      );
    }
    ensureExecutable(binary);
    this.cwd = options.cwd;
    this.tsconfig = options.tsconfig;
    this.binary = binary;
  }

  /** Return a graph for the current disk snapshot, serialized per tool call. */
  public graph(): Promise<TtscGraphMemory> {
    let resolve!: (graph: TtscGraphMemory) => void;
    let reject!: (error: Error) => void;
    const result = new Promise<TtscGraphMemory>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    this.queue = this.queue
      .catch(() => undefined)
      .then(async () => {
        try {
          resolve(await this.refresh());
        } catch (error) {
          reject(asError(error));
        }
      });
    return result;
  }

  /** Close the native session. Safe to call more than once. */
  public close(): void {
    this.closed = true;
    const child = this.child;
    this.child = undefined;
    if (child !== undefined && !child.killed) child.stdin.end();
    this.failPending(new Error("@ttsc/graph: native session closed"));
  }

  private async refresh(): Promise<TtscGraphMemory> {
    const response = await this.request();
    if (response.error !== undefined) {
      throw new Error(`@ttsc/graph: ${response.error}`);
    }
    if (response.changed) {
      if (response.dump === undefined) {
        throw new Error(
          `@ttsc/graph: native ${response.mode ?? "changed"} response omitted its dump`,
        );
      }
      const dump = typia.assert<ITtscGraphDump>(response.dump);
      this.current = TtscGraphMemory.from(dump);
    }
    if (this.current === undefined) {
      throw new Error(
        "@ttsc/graph: native session returned no initial graph snapshot",
      );
    }
    return this.current;
  }

  private request(): Promise<SessionResponse> {
    const child = this.ensureChild();
    const id = ++this.nextId;
    return new Promise<SessionResponse>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      child.stdin.write(`${JSON.stringify({ id })}\n`, (error) => {
        if (error === null || error === undefined) return;
        this.pending.delete(id);
        reject(
          new Error(
            `@ttsc/graph: could not request native snapshot: ${error.message}`,
          ),
        );
      });
    });
  }

  private ensureChild(): ChildProcessWithoutNullStreams {
    if (this.closed) {
      // A request queued behind the close must not respawn the native
      // process; an orphaned resident compiler would outlive the MCP server.
      throw new Error("@ttsc/graph: native session is closed");
    }
    if (this.child !== undefined && this.child.exitCode === null) {
      return this.child;
    }
    this.stderr = "";
    const child = spawn(
      this.binary,
      ["serve", "--cwd", this.cwd, "--tsconfig", this.tsconfig],
      { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
    );
    this.child = child;
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      this.stderr = (this.stderr + chunk).slice(-64 * 1024);
    });
    const lines = readline.createInterface({ input: child.stdout });
    lines.on("line", (line) => this.onLine(line));
    child.on("error", (error) => this.failChild(child, error));
    child.on("exit", (code, signal) => {
      if (this.child !== child) return;
      this.child = undefined;
      this.failPending(
        new Error(
          `@ttsc/graph: native session exited (code=${String(code)}, signal=${String(signal)})${
            this.stderr.trim() === "" ? "" : `: ${this.stderr.trim()}`
          }`,
        ),
      );
    });
    return child;
  }

  private onLine(line: string): void {
    let response: SessionResponse;
    try {
      response = JSON.parse(line) as SessionResponse;
    } catch (error) {
      this.failPending(
        new Error(
          `@ttsc/graph: native session returned invalid JSON: ${asError(error).message}`,
        ),
      );
      return;
    }
    const pending = this.pending.get(response.id);
    if (pending === undefined) return;
    this.pending.delete(response.id);
    pending.resolve(response);
  }

  private failChild(child: ChildProcessWithoutNullStreams, error: Error): void {
    if (this.child === child) this.child = undefined;
    this.failPending(
      new Error(`@ttsc/graph: native session failed: ${error.message}`),
    );
  }

  private failPending(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
