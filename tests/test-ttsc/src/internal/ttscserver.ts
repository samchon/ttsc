import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import { resolveTsgo } from "../../../../packages/ttsc/lib/compiler/internal/resolveTsgo.js";
import { resolveTtscserverBinary } from "../../../../packages/ttsc/lib/launcher/internal/resolveTtscserverBinary.js";

/**
 * Minimal JSON-RPC LSP client used by ttscserver e2e tests. Spawns the native
 * ttscserver binary (resolved exactly the way the JS launcher would resolve it
 * for editors), drives a real stdio handshake, and exposes typed
 * request/notification helpers so individual feature files stay focused on the
 * assertion.
 *
 * It answers server→client requests as an editor does; see
 * {@link SERVER_REQUEST_RESPONDERS} for why that is a correctness requirement
 * rather than politeness.
 */
export class TtscserverClient {
  private readonly child: ChildProcessWithoutNullStreams;
  private buffer = Buffer.alloc(0);
  private stderr = "";
  private pending = new Map<
    string | number,
    {
      reject: (err: Error) => void;
      resolve: (value: any) => void;
      timer?: NodeJS.Timeout;
    }
  >();
  private notificationListeners = new Map<string, ((params: any) => void)[]>();
  private serverRequests: string[] = [];
  private nextId = 1;
  private exited: Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>;

  constructor(
    binary: string,
    cwd: string,
    options: {
      args?: readonly string[];
      env?: NodeJS.ProcessEnv;
      injectTtscserverBinary?: boolean;
      useNode?: boolean;
    } = {},
  ) {
    const tsgoBinary =
      process.env.TTSC_TSGO_BINARY ??
      resolveTsgo({
        cwd,
        resolveFrom: path.join(ttscPackageRoot(), "package.json"),
      }).binary;
    const args = options.args ?? ["--stdio", "--cwd", cwd];
    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      TTSC_BINARY: ttscNativeBinary(),
      TTSC_NODE_BINARY: process.execPath,
      TTSC_TTSX_BINARY: path.join(
        ttscPackageRoot(),
        "lib",
        "launcher",
        "ttsx.js",
      ),
      TTSC_TSGO_BINARY: tsgoBinary,
      PATH: prependGoToPath(),
      ...options.env,
    };
    if (options.injectTtscserverBinary === false) {
      delete childEnv.TTSCSERVER_BINARY;
    } else {
      childEnv.TTSCSERVER_BINARY = resolveTtscserverBinary() ?? undefined;
    }
    this.child = spawn(
      options.useNode ? process.execPath : binary,
      [...(options.useNode ? [binary] : []), ...args],
      {
        stdio: ["pipe", "pipe", "pipe"],
        env: childEnv,
        windowsHide: true,
      },
    );
    this.child.stderr.on("data", (chunk: Buffer) => {
      // Drain stderr so upstream tsgo logs do not block the pipe.
      this.stderr = (this.stderr + chunk.toString("utf8")).slice(-65536);
    });
    this.child.stdin.on("error", () => {
      // A write that loses the race with the child's exit (EPIPE) must not
      // become an uncaught exception that takes down the whole suite process.
      // A dead child is already reported through the `close` handler below,
      // which rejects every pending request with the collected stderr.
    });
    this.child.stdout.on("data", (chunk: Buffer) => this.onData(chunk));
    this.exited = new Promise((resolve) => {
      this.child.on("close", (code, signal) => {
        this.rejectPending(
          new Error(
            `ttscserver exited before response (code=${code}, signal=${signal}, stderr=${this.stderr})`,
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

  /** Start the JavaScript launcher so tests cover project plugin discovery. */
  static startLauncher(
    cwd: string,
    options: {
      env?: NodeJS.ProcessEnv;
      injectTtscserverBinary?: boolean;
      tsconfig?: string;
    } = {},
  ): TtscserverClient {
    const launcher = path.join(
      ttscPackageRoot(),
      "lib",
      "launcher",
      "ttscserver.js",
    );
    const args = [
      "--stdio",
      "--cwd",
      cwd,
      ...(options.tsconfig ? ["--tsconfig", options.tsconfig] : []),
    ];
    return new TtscserverClient(launcher, cwd, {
      args,
      env: options.env,
      injectTtscserverBinary: options.injectTtscserverBinary,
      useNode: true,
    });
  }

  /**
   * Send a JSON-RPC request and wait for its response. There is intentionally
   * no default timeout: a request may legitimately take as long as the server
   * needs (a cold source-plugin build during project load can run for minutes),
   * and the only real failure is the server dying — handled by rejecting every
   * pending request when the child closes. Pass `timeoutMs` only when a caller
   * deliberately wants to bound the wait (e.g. a best-effort shutdown probe).
   */
  async request<T = unknown>(
    method: string,
    params?: unknown,
    timeoutMs?: number,
  ): Promise<T> {
    const id = this.nextId++;
    const promise = new Promise<T>((resolve, reject) => {
      const timer =
        timeoutMs === undefined
          ? undefined
          : setTimeout(() => {
              this.pending.delete(id);
              reject(
                new Error(
                  `timed out waiting for ${method} response (stderr=${this.stderr})`,
                ),
              );
            }, timeoutMs);
      this.pending.set(id, { reject, resolve, timer });
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

  /**
   * Resolve once a matching notification arrives. Like {@link request}, there is
   * no default timeout — the awaited diagnostics may follow a multi-minute cold
   * plugin build; a dead server rejects it via the close handler. Pass
   * `timeoutMs` only to deliberately bound the wait.
   */
  waitForNotification<T = unknown>(
    method: string,
    predicate: (params: T) => boolean = () => true,
    timeoutMs?: number,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let listener: (params: T) => void = () => undefined;
      const timer =
        timeoutMs === undefined
          ? undefined
          : setTimeout(() => {
              this.off(method, listener);
              reject(
                new Error(
                  `timed out waiting for ${method} notification (stderr=${this.stderr})`,
                ),
              );
            }, timeoutMs);
      listener = (params: T) => {
        if (!predicate(params)) return;
        if (timer !== undefined) clearTimeout(timer);
        this.off(method, listener);
        resolve(params);
      };
      this.on(method, listener);
    });
  }

  async waitForExit(): Promise<number | null> {
    const { code } = await this.exited;
    return code;
  }

  stderrText(): string {
    return this.stderr;
  }

  /**
   * Methods of the server→client requests received so far, in arrival order.
   * Tests use it to pin that the handshake the upstream server blocks on
   * actually happened rather than inferring it from a feature that worked. A
   * request that arrives after the shutdown sequence closed stdin is recorded
   * here too, even though there is no longer anyone to answer it.
   */
  serverRequestMethods(): readonly string[] {
    return [...this.serverRequests];
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

  private off(method: string, listener: (params: any) => void): void {
    const list = this.notificationListeners.get(method);
    if (!list) return;
    const next = list.filter((entry) => entry !== listener);
    if (next.length === 0) {
      this.notificationListeners.delete(method);
    } else {
      this.notificationListeners.set(method, next);
    }
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
      this.answerServerRequest(message);
      return;
    }
    if (typeof message.id !== "undefined") {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (pending.timer !== undefined) clearTimeout(pending.timer);
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

  /**
   * Answer a request the server sent to its client.
   *
   * Every LSP client owes a response to every server→client request, and this
   * one is load-bearing rather than a courtesy: TypeScript-Go issues
   * `client/registerCapability` from inside its `initialized` handler, which
   * runs on its dispatch loop, and it blocks there until the reply arrives. A
   * client that drops the request therefore still sees `initialize` answered
   * and still receives everything ttscserver publishes on its own, while every
   * request the proxy forwards — hover, completion, symbols — queues behind a
   * dispatch loop that never advances again (#863).
   */
  private answerServerRequest(message: {
    id: number | string;
    method: string;
    params?: any;
  }): void {
    this.serverRequests.push(message.method);
    if (this.child.stdin.writableEnded || this.child.stdin.destroyed) {
      // The shutdown sequence already closed the write side. tsgo keeps
      // registering file watchers in the background, so a late request can
      // still arrive here, and there is no longer anyone waiting on the answer.
      return;
    }
    const responder =
      SERVER_REQUEST_RESPONDERS.get(message.method) ?? (() => null);
    try {
      this.send({
        jsonrpc: "2.0",
        id: message.id,
        result: responder(message.params),
      });
    } catch (error) {
      // A responder that throws must still unblock the server: a JSON-RPC
      // error response ends the wait just as a result does, and the failure
      // stays visible in the message the server logs.
      this.send({
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) {
      if (pending.timer !== undefined) clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

/**
 * Results for the server→client requests this client knows how to answer,
 * shaped the way the LSP specification defines each one.
 *
 * A method missing from the table is answered with `null`, which is the valid
 * result for the client requests that carry no payload (the message and
 * progress lifecycles among them) and, more importantly, keeps an unknown
 * future request from stalling the server the way an unanswered one would.
 *
 * The two entries whose result is not `null` are the ones a `null` would fail
 * to decode: `workspace/configuration` must return one settings object per
 * requested item, and `workspace/applyEdit` must report whether the edit was
 * applied — these tests never apply one, so they decline it truthfully.
 *
 * A Map rather than an object literal: the key is a method name straight off
 * the wire, and an object lookup would resolve `constructor` or `toString` to
 * an inherited function and answer with whatever it returned.
 */
const SERVER_REQUEST_RESPONDERS = new Map<string, (params: any) => unknown>([
  ["client/registerCapability", () => null],
  ["client/unregisterCapability", () => null],
  ["window/workDoneProgress/create", () => null],
  ["workspace/applyEdit", () => ({ applied: false })],
  [
    "workspace/configuration",
    (params: any) => ((params?.items ?? []) as unknown[]).map(() => ({})),
  ],
]);

export async function initializeTtscserverClient(
  client: TtscserverClient,
  root: string,
): Promise<void> {
  await client.request("initialize", {
    processId: process.pid,
    rootUri: pathToFileURL(root).href,
    capabilities: {},
  });
  client.notify("initialized", {});
}

export async function shutdownTtscserverClient(
  client: TtscserverClient,
): Promise<void> {
  const shutdownResult = await client
    .request("shutdown", undefined, 500)
    .then(() => "", formatUnknown);
  client.notify("exit");
  client.endStdin();
  const code = await client.waitForExit();
  const detail = `shutdownResponse=${shutdownResult}\nstderr=${client.stderrText()}`;
  assert.equal(code, 0, `ttscserver should exit cleanly\n${detail}`);
}

function formatUnknown(value: unknown): string {
  if (!value) {
    return "";
  }
  if (value instanceof Error) {
    return value.stack ?? value.message;
  }
  return String(value);
}

/**
 * Resolve the workspace ttsc package root so feature files do not need to
 * encode the absolute path themselves.
 */
export function ttscPackageRoot(): string {
  return path.join(findWorkspaceRoot(process.cwd()), "packages", "ttsc");
}

export function ttscNativeBinary(): string {
  const binary = path.join(
    findWorkspaceRoot(process.cwd()),
    "packages",
    `ttsc-${process.platform}-${process.arch}`,
    "bin",
    process.platform === "win32" ? "ttsc.exe" : "ttsc",
  );
  assert.ok(
    fs.existsSync(binary),
    `ttsc native binary does not exist: ${binary}`,
  );
  return binary;
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

function prependGoToPath(): string | undefined {
  const localGo = path.join(osHome(), "go-sdk", "go", "bin");
  return fs.existsSync(localGo)
    ? `${localGo}${path.delimiter}${process.env.PATH ?? ""}`
    : process.env.PATH;
}

function osHome(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? "";
}

export { assert };
