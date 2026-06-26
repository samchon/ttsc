import { TestProject } from "@ttsc/testing";
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

// Re-export the binding directly (not a re-bound const) so its assertion-function
// signatures survive: `assert.ok` narrows only when the call target carries an
// explicit type, and a `const assert = nodeAssert` copy would drop that (TS2775).
export { default as assert } from "node:assert/strict";

/**
 * Resolve the native `ttscgraph` data binary built next to `ttsc` by `pnpm
 * build:current`. The MCP server runs it once as `ttscgraph dump`; the test
 * points the launcher at it through `TTSC_GRAPH_BINARY`.
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
 * Resolve the built `@ttsc/graph` launcher (lib/bin.js), the Node entry an MCP
 * client spawns. It serves the graph over stdio after running `ttscgraph dump`
 * once for the project.
 */
export function resolveGraphLauncher(): string {
  const pkg = createRequire(import.meta.url).resolve("@ttsc/graph");
  return path.join(path.dirname(pkg), "bin.js");
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

/**
 * A minimal MCP stdio client: it spawns the `@ttsc/graph` launcher and
 * exchanges newline-delimited JSON-RPC 2.0 messages, mirroring how an agent's
 * MCP client drives the server.
 */
export class TtsgraphClient {
  private readonly child: ChildProcessWithoutNullStreams;
  private buffer = "";
  private stderr = "";
  private nextId = 0;
  private readonly pending = new Map<number, Pending>();

  static start(cwd: string): TtsgraphClient {
    return new TtsgraphClient(cwd);
  }

  private constructor(cwd: string) {
    this.child = spawn(
      process.execPath,
      [resolveGraphLauncher(), "--cwd", cwd],
      {
        stdio: ["pipe", "pipe", "pipe"],
        // The launcher resolves the dump binary from TTSC_GRAPH_BINARY, so the
        // test project needs no installed `ttsc` of its own.
        env: { ...process.env, TTSC_GRAPH_BINARY: resolveTtscgraphBinary() },
        windowsHide: true,
      },
    );
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
            `ttsc-graph ${method} timed out after ${timeoutMs}ms\nstderr: ${this.stderr}`,
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
        () =>
          reject(new Error(`ttsc-graph did not exit within ${timeoutMs}ms`)),
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
