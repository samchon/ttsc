import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import * as path from "node:path";

import { resolveTsgo } from "../../../../packages/ttsc/lib/compiler/internal/resolveTsgo.js";
import { resolveTtscserverBinary } from "../../../../packages/ttsc/lib/launcher/internal/resolveTtscserverBinary.js";

/**
 * Minimal JSON-RPC LSP client used by ttscserver e2e tests. Spawns the native
 * ttscserver binary (resolved exactly the way the JS launcher would resolve it
 * for editors), drives a real stdio handshake, and exposes typed
 * request/notification helpers so individual feature files stay focused on the
 * assertion.
 */
export class TtscserverClient {
  private readonly child: ChildProcessWithoutNullStreams;
  private buffer = Buffer.alloc(0);
  private pending = new Map<
    string | number,
    { resolve: (value: any) => void; reject: (err: Error) => void }
  >();
  private notificationListeners = new Map<string, ((params: any) => void)[]>();
  private nextId = 1;
  private exited: Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>;

  constructor(binary: string, cwd: string) {
    const tsgoBinary =
      process.env.TTSC_TSGO_BINARY ??
      resolveTsgo({
        cwd,
        resolveFrom: path.join(ttscPackageRoot(), "package.json"),
      }).binary;
    this.child = spawn(binary, ["--stdio", "--cwd", cwd], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        TTSC_TSGO_BINARY: tsgoBinary,
      },
      windowsHide: true,
    });
    this.child.stderr.on("data", () => {
      // Drain stderr so upstream tsgo logs do not block the pipe.
    });
    this.child.stdout.on("data", (chunk: Buffer) => this.onData(chunk));
    this.exited = new Promise((resolve) => {
      this.child.on("close", (code, signal) => {
        this.rejectPending(
          new Error(
            `ttscserver exited before response (code=${code}, signal=${signal})`,
          ),
        );
        resolve({ code, signal });
      });
    });
  }

  /**
   * Static factory that resolves the platform binary via the same code path the
   * JS launcher uses, so tests fail noisily on a misconfigured
   * `@ttsc/<platform>-<arch>` package instead of silently spawning a stale
   * binary somewhere on PATH.
   */
  static start(cwd: string): TtscserverClient {
    const binary = resolveTtscserverBinary();
    assert.ok(
      binary,
      "ttscserver binary not resolved — run pnpm build:current",
    );
    return new TtscserverClient(binary, cwd);
  }

  async request<T = unknown>(method: string, params?: unknown): Promise<T> {
    const id = this.nextId++;
    const promise = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.send({ jsonrpc: "2.0", id, method, params });
    return promise;
  }

  notify(method: string, params?: unknown): void {
    this.send({ jsonrpc: "2.0", method, params });
  }

  on(method: string, listener: (params: any) => void): void {
    const list = this.notificationListeners.get(method) ?? [];
    list.push(listener);
    this.notificationListeners.set(method, list);
  }

  async waitForExit(): Promise<number | null> {
    const { code } = await this.exited;
    return code;
  }

  forceClose(): void {
    if (!this.child.killed) {
      this.child.stdin.end();
    }
  }

  /**
   * Close stdin after pending writes flush. Use this once the test has finished
   * sending the shutdown sequence so the child cannot block waiting for
   * additional input after the proxy injects its synthetic shutdown.
   */
  endStdin(): void {
    this.child.stdin.end();
  }

  private send(message: unknown): void {
    const body = Buffer.from(JSON.stringify(message), "utf8");
    const header = Buffer.from(
      `Content-Length: ${body.length}\r\n\r\n`,
      "utf8",
    );
    this.child.stdin.write(Buffer.concat([header, body]));
  }

  private onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      const sep = this.buffer.indexOf("\r\n\r\n");
      if (sep < 0) {
        return;
      }
      const headers = this.buffer.subarray(0, sep).toString("utf8");
      const match = /Content-Length:\s*(\d+)/i.exec(headers);
      if (!match) {
        this.buffer = this.buffer.subarray(sep + 4);
        continue;
      }
      const length = Number(match[1]);
      const totalNeeded = sep + 4 + length;
      if (this.buffer.length < totalNeeded) {
        return;
      }
      const body = this.buffer.subarray(sep + 4, totalNeeded).toString("utf8");
      this.buffer = this.buffer.subarray(totalNeeded);
      this.dispatch(JSON.parse(body));
    }
  }

  private dispatch(message: any): void {
    if (typeof message.id !== "undefined" && message.method) {
      // Server→client request. ttscserver currently sends no such
      // requests we need to answer for these tests; ignore.
      return;
    }
    if (typeof message.id !== "undefined") {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(
          new Error(`${message.error.code}: ${message.error.message}`),
        );
      } else {
        pending.resolve(message.result);
      }
      return;
    }
    if (message.method) {
      const listeners = this.notificationListeners.get(message.method);
      if (listeners) {
        for (const listener of listeners) {
          listener(message.params);
        }
      }
    }
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }
}

/**
 * Resolve the workspace ttsc package root so feature files do not need to
 * encode the absolute path themselves.
 */
export function ttscPackageRoot(): string {
  return path.join(findWorkspaceRoot(process.cwd()), "packages", "ttsc");
}

function findWorkspaceRoot(start: string): string {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`Unable to find workspace root from ${start}`);
    }
    dir = parent;
  }
}

export { assert };
