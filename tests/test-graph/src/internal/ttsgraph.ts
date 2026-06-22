import { TestProject } from "@ttsc/testing";
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import path from "node:path";

// Re-export the binding directly (not a re-bound const) so its assertion-function
// signatures survive: `assert.ok` narrows only when the call target carries an
// explicit type, and a `const assert = nodeAssert` copy would drop that (TS2775).
export { default as assert } from "node:assert/strict";

/**
 * Resolve the native `ttscgraph` MCP server binary the same way the @ttsc/graph
 * launcher would: an absolute `TTSC_GRAPH_BINARY` override, otherwise the
 * per-platform binary built next to `ttsc` by `pnpm build:current`.
 */
export function resolveTtscgraphBinary(): string {
  const override = process.env.TTSC_GRAPH_BINARY;
  if (override && path.isAbsolute(override)) {
    return override;
  }
  const exe = process.platform === "win32" ? "ttscgraph.exe" : "ttscgraph";
  return path.join(path.dirname(TestProject.NATIVE_BINARY), exe);
}

/**
 * Spawn `ttscgraph --daemon`: build the Program once and serve many proxy
 * connections over a localhost port, writing the chosen `host:port` to
 * `portFile`. The returned child is the long-lived daemon the caller must
 * kill.
 *
 * `--idle 0` disables the idle-exit timer so the daemon never removes the port
 * file or shuts down out from under a slow test; the caller owns its lifetime.
 */
export function spawnDaemon(
  cwd: string,
  portFile: string,
  tsconfig = "tsconfig.json",
): ChildProcessWithoutNullStreams {
  return spawn(
    resolveTtscgraphBinary(),
    [
      "--daemon",
      "--cwd",
      cwd,
      "--tsconfig",
      tsconfig,
      "--port-file",
      portFile,
      "--idle",
      "0",
    ],
    {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
      windowsHide: true,
    },
  );
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

/**
 * A minimal MCP stdio client: it spawns `ttscgraph --stdio` and exchanges
 * newline-delimited JSON-RPC 2.0 messages, mirroring how an agent's MCP client
 * drives the server.
 */
export class TtsgraphClient {
  private readonly child: ChildProcessWithoutNullStreams;
  private buffer = "";
  private stderr = "";
  private nextId = 0;
  private readonly pending = new Map<number, Pending>();

  static start(cwd: string): TtsgraphClient {
    return new TtsgraphClient(["--stdio", "--cwd", cwd]);
  }

  /**
   * Drive a `ttscgraph --connect <addr>` proxy exactly like the stdio client:
   * the proxy pipes this stdio to a warm daemon, so the same JSON-RPC handshake
   * and `endStdin`/`waitForExit` lifecycle apply transparently.
   */
  static connect(addr: string): TtsgraphClient {
    return new TtsgraphClient(["--connect", addr]);
  }

  private constructor(args: string[]) {
    this.child = spawn(resolveTtscgraphBinary(), args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
      windowsHide: true,
    });
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => this.onData(chunk));
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk: string) => {
      this.stderr += chunk;
    });
  }

  request(
    method: string,
    params: unknown,
    timeoutMs = 120_000,
  ): Promise<unknown> {
    const id = ++this.nextId;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            `ttscgraph ${method} timed out after ${timeoutMs}ms\nstderr: ${this.stderr}`,
          ),
        );
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(
        `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`,
      );
    });
  }

  notify(method: string, params?: unknown): void {
    this.child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`,
    );
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    for (
      let newline = this.buffer.indexOf("\n");
      newline >= 0;
      newline = this.buffer.indexOf("\n")
    ) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (line === "") continue;
      const message = JSON.parse(line) as {
        id?: number;
        result?: unknown;
        error?: { message: string };
      };
      if (typeof message.id === "number" && this.pending.has(message.id)) {
        const entry = this.pending.get(message.id)!;
        this.pending.delete(message.id);
        clearTimeout(entry.timer);
        if (message.error) entry.reject(new Error(message.error.message));
        else entry.resolve(message.result);
      }
    }
  }

  endStdin(): void {
    this.child.stdin.end();
  }

  waitForExit(timeoutMs = 30_000): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`ttscgraph did not exit within ${timeoutMs}ms`)),
        timeoutMs,
      );
      this.child.on("exit", (code) => {
        clearTimeout(timer);
        resolve(code ?? 0);
      });
    });
  }

  stderrText(): string {
    return this.stderr;
  }
}
