import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import readline from "node:readline";
import typia from "typia";

import { ensureExecutable } from "../nativeExecutable";
import { resolveGraphBinary } from "../resolveGraphBinary";
import { ITtscGraphSnapshot } from "../structures/ITtscGraphSnapshot";
import { TtscGraphMemory } from "./TtscGraphMemory";

/**
 * The serve protocol version this client speaks.
 *
 * Keep it equal to `serveProtocolVersion` in
 * `packages/ttsc/cmd/ttscgraph/serve.go`. The two are hand-synchronized, and
 * `serve_protocol_version_matches_the_typescript_client_test.go` reads this
 * constant out of this file and fails if the pair drifts.
 */
const PROTOCOL_VERSION = 1;

interface Pending {
  resolve: (response: ITtscGraphSnapshot) => void;
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
    // The protocol version and the envelope shape were both settled in onLine,
    // before this frame was ever routed here.
    const response = await this.request();
    if (response.error !== undefined) {
      throw new Error(`@ttsc/graph: ${response.error}`);
    }
    if (response.changed) {
      if (response.dump === undefined) {
        throw new Error(
          `@ttsc/graph: native ${response.mode} response omitted its dump`,
        );
      }
      this.current = TtscGraphMemory.from(response.dump);
    }
    if (this.current === undefined) {
      throw new Error(
        "@ttsc/graph: native session returned no initial graph snapshot",
      );
    }
    return this.current;
  }

  private request(): Promise<ITtscGraphSnapshot> {
    const child = this.ensureChild();
    const id = ++this.nextId;
    return new Promise<ITtscGraphSnapshot>((resolve, reject) => {
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
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      this.failPending(
        new Error(
          `@ttsc/graph: native session returned invalid JSON: ${asError(error).message}`,
        ),
      );
      return;
    }

    // Read the version before the shape, because a server speaking another
    // version is entitled to a different shape. Asserting first would report
    // that mismatch as a field complaint — "expected string at $input.mode" —
    // about a contract the other side never agreed to, which is the misparse
    // this field exists to prevent. Ask what protocol it is first, then hold it
    // to that protocol.
    const version: number | undefined = typia.is<{ protocolVersion: number }>(
      parsed,
    )
      ? parsed.protocolVersion
      : undefined;
    if (version !== PROTOCOL_VERSION) {
      // Session-wide: a version mismatch is not one bad frame, it is the wrong
      // binary, and every request against it is equally doomed.
      this.failPending(
        new Error(
          `@ttsc/graph: ttscgraph speaks serve protocol ${
            version === undefined ? "an unknown version" : `v${String(version)}`
          }, this client speaks v${String(PROTOCOL_VERSION)}. ` +
            "Install a matching `ttsc` (the binary resolves from the target " +
            "project, or from TTSC_GRAPH_BINARY).",
        ),
      );
      return;
    }

    let response: ITtscGraphSnapshot;
    try {
      // Validate the envelope, not just the dump it carries. The dump was
      // typia-asserted while the envelope around it was a bare cast, so the
      // fields the client actually branches on — the mode, and the id that
      // routes the frame — were the unchecked ones. Anything added to the
      // envelope belongs on this side of that line.
      response = typia.assert<ITtscGraphSnapshot>(parsed);
    } catch (error) {
      this.failPending(
        new Error(
          `@ttsc/graph: native session returned an unreadable response: ${asError(error).message}`,
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
