import { TestProject } from "@ttsc/testing";
import { type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";

const { spawn } = E2eProcessTrace;

// Re-export the binding directly (not a re-bound const) so its assertion-function
// signatures survive: `assert.ok` narrows only when the call target carries an
// explicit type, and a `const assert = nodeAssert` copy would drop that (TS2775).
export { default as assert } from "node:assert/strict";

/**
 * Resolve the native `ttscgraph` data binary built next to `ttsc` by `pnpm
 * build:current`. The MCP server keeps its `ttscgraph serve` compiler session
 * resident; the test points the launcher at it through `TTSC_GRAPH_BINARY`.
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
 * client spawns. It serves the graph over stdio and synchronizes the resident
 * native snapshot before each graph operation.
 */
export function resolveGraphLauncher(): string {
  const pkg = createRequire(import.meta.url).resolve("@ttsc/graph");
  return path.join(path.dirname(pkg), "bin.js");
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer?: NodeJS.Timeout;
}

/**
 * A minimal MCP stdio client: it spawns the `@ttsc/graph` launcher and
 * exchanges newline-delimited JSON-RPC 2.0 messages, mirroring how an agent's
 * MCP client drives the server.
 *
 * The shared identity owner enables a process-diagnostics preload. It records
 * successful exact-producer children and their process/stdio close events in an
 * owned file without replacing spawn. Synchronous observation may alter
 * scheduling, so it establishes ownership counts rather than race timings.
 */
export class TtsgraphClient {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly closed: Promise<number>;
  private failure: Error | undefined;
  private unconfirmedTransport = false;
  private closing = false;
  private buffer = "";
  private stderr = "";
  private nextId = 0;
  private readonly pending = new Map<number, Pending>();

  /**
   * Start the real launcher with optional caller-owned source build caches.
   * Omitted cache paths preserve the launcher's inherited selection; explicit
   * paths change storage only, leaving SDK discovery and build validation
   * intact.
   */
  static start(
    cwd: string,
    nativeSpawnReceipt?: string,
    options: { cacheDir?: string; goBuildCacheDir?: string } = {},
  ): TtsgraphClient {
    if (nativeSpawnReceipt !== undefined)
      fs.writeFileSync(nativeSpawnReceipt, "", { flag: "wx" });
    const child = spawn(
      process.execPath,
      [
        ...(nativeSpawnReceipt === undefined
          ? []
          : [
              "--import",
              new URL("./nativeSpawnObserver.mjs", import.meta.url).href,
            ]),
        resolveGraphLauncher(),
        "--cwd",
        cwd,
      ],
      {
        stdio: ["pipe", "pipe", "pipe"],
        // The launcher resolves the native graph binary from TTSC_GRAPH_BINARY, so the
        // test project needs no installed `ttsc` of its own.
        env: {
          ...process.env,
          TTSC_GRAPH_BINARY: resolveTtscgraphBinary(),
          ...(options.cacheDir === undefined
            ? {}
            : { TTSC_CACHE_DIR: options.cacheDir }),
          ...(options.goBuildCacheDir === undefined
            ? {}
            : { TTSC_GO_CACHE_DIR: options.goBuildCacheDir }),
          ...(nativeSpawnReceipt === undefined
            ? {}
            : { TTSC_E2E_GRAPH_SPAWN_RECEIPT: nativeSpawnReceipt }),
        },
        windowsHide: true,
      },
    );
    return TtsgraphClient.connect(child, nativeSpawnReceipt);
  }

  /** Attach this same stdio owner to an actual caller-owned Node child. */
  static connect(
    child: ChildProcessWithoutNullStreams,
    nativeSpawnReceipt?: string,
  ): TtsgraphClient {
    return new TtsgraphClient(child, nativeSpawnReceipt);
  }

  private constructor(
    child: ChildProcessWithoutNullStreams,
    private readonly nativeSpawnReceipt?: string,
  ) {
    this.child = child;
    this.closed = new Promise<number>((resolve) => {
      this.child.once("error", (error) => this.fail(error, true));
      this.child.once("close", (code) => {
        this.fail(
          new Error(
            `ttsc-graph closed (${String(code)})\nstderr: ${this.stderr}`,
          ),
          !this.closing || this.pending.size !== 0,
        );
        resolve(code ?? 1);
      });
    });
    for (const stream of [
      this.child.stdin,
      this.child.stdout,
      this.child.stderr,
    ])
      stream.on("error", (error) => this.fail(error, true));
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => this.onData(chunk));
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk: string) => {
      this.stderr += chunk;
    });
  }

  /** Ordinary requests settle from the actual response or transport failure. */
  request(
    method: string,
    params: unknown,
    timeoutMs?: number,
  ): Promise<unknown> {
    if (this.failure !== undefined) return Promise.reject(this.failure);
    const id = ++this.nextId;
    return new Promise<unknown>((resolve, reject) => {
      const timer =
        timeoutMs === undefined
          ? undefined
          : setTimeout(() => {
              this.fail(
                new Error(
                  `ttsc-graph ${method} timed out after ${timeoutMs}ms\nstderr: ${this.stderr}`,
                ),
                true,
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
      let message: {
        id?: number;
        result?: unknown;
        error?: { message: string };
      };
      try {
        const decoded: unknown = JSON.parse(line);
        if (
          decoded === null ||
          typeof decoded !== "object" ||
          Array.isArray(decoded)
        )
          throw new Error("Graph MCP transport returned a non-object frame");
        message = decoded as typeof message;
      } catch (error) {
        this.fail(
          error instanceof Error ? error : new Error(String(error)),
          true,
        );
        return;
      }
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
    this.closing = true;
    this.child.stdin.end();
  }

  /** Join original process/stdio close; an explicit timeout tests caller policy. */
  async waitForExit(timeoutMs?: number): Promise<number> {
    if (timeoutMs === undefined) return this.closed;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.closed,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            const timeout = new Error(
              `ttsc-graph did not exit within ${timeoutMs}ms`,
            );
            this.fail(timeout, true);
            try {
              this.child.kill();
            } catch (error) {
              reject(new AggregateError([timeout, error], timeout.message));
              return;
            }
            reject(timeout);
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  private fail(error: Error, unconfirmedTransport = false): void {
    this.unconfirmedTransport ||= unconfirmedTransport;
    this.failure ??= error;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  stderrText(): string {
    return this.stderr;
  }

  /** Withdraw subsequent borrowing when shared input restoration failed. */
  preventInputReuse(reason: string): void {
    this.fail(new Error(`Shared graph inputs cannot be reused: ${reason}`));
  }

  /** Reject consumers whose shared transport or restored inputs are unavailable. */
  assertReusable(): void {
    if (this.failure !== undefined) throw this.failure;
  }

  /** A failed caller policy or lost transport may still have a native input reader. */
  inputsHaveUnconfirmedReaders(): boolean {
    return this.unconfirmedTransport;
  }

  /** Refuse filesystem edits until the experiment establishes actual child EOF. */
  assertInputMutationAllowed(): void {
    if (this.unconfirmedTransport)
      throw new Error(
        "Graph input mutation refused while child completion is unconfirmed",
        { cause: this.failure },
      );
  }

  /**
   * Read synchronous receipts of successful native children for this session's
   * exact producer.
   */
  nativeSpawnCount(): number {
    if (this.nativeSpawnReceipt === undefined)
      throw new Error("Native observation was not enabled for this client");
    return fs
      .readFileSync(this.nativeSpawnReceipt, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { event: string })
      .filter((entry) => entry.event === "spawned").length;
  }

  /**
   * Require a delivered process-and-stdio close receipt for every observed
   * native child.
   */
  assertNativeChildrenJoined(): void {
    if (this.nativeSpawnReceipt === undefined)
      throw new Error("Native observation was not enabled for this client");
    const receipts = fs
      .readFileSync(this.nativeSpawnReceipt, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { event: string; id: number });
    const spawned = receipts
      .filter((entry) => entry.event === "spawned")
      .map((entry) => entry.id);
    const closed = receipts
      .filter((entry) => entry.event === "closed")
      .map((entry) => entry.id)
      .sort((a, b) => a - b);
    if (JSON.stringify(spawned) !== JSON.stringify(closed))
      throw new Error(
        `Observed native child lifetimes were not all joined: ${JSON.stringify(receipts)}`,
      );
  }
}
