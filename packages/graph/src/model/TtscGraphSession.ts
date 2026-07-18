import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import readline from "node:readline";
import typia from "typia";

import { ensureExecutable } from "../nativeExecutable";
import { resolveGraphBinary } from "../resolveGraphBinary";
import { ITtscGraphSnapshot } from "../structures/ITtscGraphSnapshot";
import { TtscGraphMemory } from "./TtscGraphMemory";
import { DUMP_SCHEMA_VERSION } from "./loadGraph";

/**
 * The serve protocol version this client speaks.
 *
 * Keep it equal to `serveProtocolVersion` in
 * `packages/ttsc/cmd/ttscgraph/serve.go`. The two are hand-synchronized, and
 * `serve_protocol_version_matches_the_typescript_client_test.go` reads this
 * constant out of this file and fails if the pair drifts.
 */
const PROTOCOL_VERSION = 1;
const DEFAULT_REQUEST_TIMEOUT_MS = 300_000;
const MAX_TIMER_MS = 2_147_483_647;
const TERMINATION_GRACE_MS = 1_000;

interface Pending {
  child: NativeChild;
  resolve: (response: ITtscGraphSnapshot) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
  signal?: AbortSignal;
  abort?: () => void;
}

interface NativeChild {
  process: ChildProcessWithoutNullStreams;
  lines: readline.Interface;
  stderr: string;
}

/** Construction options for a resident native graph session. */
export interface TtscGraphSessionOptions {
  /** Project root passed to `ttscgraph serve`. */
  cwd: string;
  /** Project tsconfig passed to `ttscgraph serve`. */
  tsconfig: string;
  /** Absolute native binary path, resolved from `cwd` when omitted. */
  binary?: string;
  /**
   * Maximum time for one native snapshot response. Defaults to five minutes,
   * which is more than ten times the published 28.7-second VS Code cold index.
   */
  requestTimeoutMs?: number;
}

/** Per-call controls for a native graph refresh. */
export interface TtscGraphRequestOptions {
  /** Cancel this refresh and retire its native session. */
  signal?: AbortSignal;
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
  private readonly requestTimeoutMs: number;
  private child: NativeChild | undefined;
  private nextId = 0;
  private readonly pending = new Map<number, Pending>();
  private queue: Promise<void> = Promise.resolve();
  private current: TtscGraphMemory | undefined;
  private closed = false;

  public constructor(options: TtscGraphSessionOptions) {
    const requestTimeoutMs =
      options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    if (
      !Number.isSafeInteger(requestTimeoutMs) ||
      requestTimeoutMs <= 0 ||
      requestTimeoutMs > MAX_TIMER_MS
    ) {
      throw new TypeError(
        `@ttsc/graph: requestTimeoutMs must be an integer between 1 and ${String(MAX_TIMER_MS)}`,
      );
    }
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
    this.requestTimeoutMs = requestTimeoutMs;
  }

  /** Return a graph for the current disk snapshot, serialized per tool call. */
  public graph(
    options: TtscGraphRequestOptions = {},
  ): Promise<TtscGraphMemory> {
    if (this.closed) {
      return Promise.reject(new Error("@ttsc/graph: native session is closed"));
    }
    let resolve!: (graph: TtscGraphMemory) => void;
    let reject!: (error: Error) => void;
    let started = false;
    let settled = false;
    const result = new Promise<TtscGraphMemory>((res, rej) => {
      resolve = (graph) => {
        if (settled) return;
        settled = true;
        res(graph);
      };
      reject = (error) => {
        if (settled) return;
        settled = true;
        rej(error);
      };
    });
    const cancelQueued = () => {
      if (!started) reject(cancelledError(options.signal));
    };
    if (options.signal?.aborted) {
      reject(cancelledError(options.signal));
      return result;
    }
    options.signal?.addEventListener("abort", cancelQueued, { once: true });
    this.queue = this.queue
      .catch(() => undefined)
      .then(async () => {
        started = true;
        options.signal?.removeEventListener("abort", cancelQueued);
        if (settled) return;
        try {
          resolve(await this.refresh(options.signal));
        } catch (error) {
          reject(asError(error));
        }
      });
    return result;
  }

  /** Close the native session. Safe to call more than once. */
  public close(): void {
    if (this.closed) return;
    this.closed = true;
    const error = new Error("@ttsc/graph: native session closed");
    if (this.child !== undefined) this.failChild(this.child, error);
    else this.failPending(error);
  }

  private async refresh(signal?: AbortSignal): Promise<TtscGraphMemory> {
    // The protocol version and the envelope shape were both settled in onLine,
    // before this frame was ever routed here.
    const response = await this.request(signal);
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

  private request(signal?: AbortSignal): Promise<ITtscGraphSnapshot> {
    if (signal?.aborted) throw cancelledError(signal);
    const child = this.ensureChild();
    const id = ++this.nextId;
    return new Promise<ITtscGraphSnapshot>((resolve, reject) => {
      const pending: Pending = {
        child,
        resolve,
        reject,
        timer: setTimeout(() => {
          this.failChild(
            child,
            new Error(
              `@ttsc/graph: native snapshot request timed out after ${String(this.requestTimeoutMs)} ms${stderrSuffix(child)}`,
            ),
          );
        }, this.requestTimeoutMs),
        signal,
      };
      pending.timer.unref();
      if (signal !== undefined) {
        pending.abort = () =>
          this.failChild(child, cancelledError(signal, child));
        signal.addEventListener("abort", pending.abort, { once: true });
      }
      this.pending.set(id, pending);
      if (signal?.aborted) {
        pending.abort!();
        return;
      }
      child.process.stdin.write(`${JSON.stringify({ id })}\n`, (error) => {
        if (error === null || error === undefined) return;
        if (this.pending.get(id) !== pending) return;
        this.failChild(
          child,
          new Error(
            `@ttsc/graph: could not request native snapshot: ${error.message}`,
          ),
        );
      });
    });
  }

  private ensureChild(): NativeChild {
    if (this.closed) {
      // A request queued behind the close must not respawn the native
      // process; an orphaned resident compiler would outlive the MCP server.
      throw new Error("@ttsc/graph: native session is closed");
    }
    if (
      this.child !== undefined &&
      this.child.process.exitCode === null &&
      this.child.process.signalCode === null
    ) {
      return this.child;
    }
    const process = spawn(
      this.binary,
      ["serve", "--cwd", this.cwd, "--tsconfig", this.tsconfig],
      { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
    );
    const lines = readline.createInterface({ input: process.stdout });
    const child: NativeChild = { process, lines, stderr: "" };
    this.child = child;
    process.stderr.setEncoding("utf8");
    process.stderr.on("data", (chunk: string) => {
      child.stderr = (child.stderr + chunk).slice(-64 * 1024);
    });
    lines.on("line", (line) => this.onLine(child, line));
    process.on("error", (error) =>
      this.failChild(
        child,
        new Error(`@ttsc/graph: native session failed: ${error.message}`),
      ),
    );
    process.on("exit", (code, signal) => {
      if (this.child !== child) return;
      this.failChild(
        child,
        new Error(
          `@ttsc/graph: native session exited (code=${String(code)}, signal=${String(signal)})${stderrSuffix(
            child,
          )}`,
        ),
        false,
      );
    });
    return child;
  }

  private onLine(child: NativeChild, line: string): void {
    if (this.child !== child) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      this.failChild(
        child,
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
      this.failChild(
        child,
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
      this.failChild(
        child,
        new Error(
          `@ttsc/graph: native session returned an unreadable response: ${asError(error).message}`,
        ),
      );
      return;
    }
    // The envelope's version is not the body's, and only the envelope has been
    // held to one so far. A producer can speak this protocol and still carry a
    // dump from another schema — the two move apart the moment a node field is
    // added without the frame around it changing — and then the facts that field
    // holds are silently absent rather than refused. `literals` is exactly that
    // shape: an older producer resolves no value set, so a union comes back
    // looking like a type with no members. Hold the body to its own number too,
    // once the frame is understood.
    if (
      response.dump !== undefined &&
      response.dump.provenance.schemaVersion !== DUMP_SCHEMA_VERSION
    ) {
      // Session-wide, for the same reason the protocol mismatch above is: it is
      // the wrong binary, not one bad frame.
      this.failChild(
        child,
        new Error(
          `@ttsc/graph: ttscgraph sends dump schema v${String(
            response.dump.provenance.schemaVersion,
          )}, this client reads v${String(DUMP_SCHEMA_VERSION)}. ` +
            "Install a matching `ttsc` (the binary resolves from the target " +
            "project, or from TTSC_GRAPH_BINARY).",
        ),
      );
      return;
    }

    const pending = this.pending.get(response.id);
    if (pending === undefined || pending.child !== child) return;
    this.settlePending(response.id, pending, response);
  }

  private failChild(child: NativeChild, error: Error, terminate = true): void {
    if (this.child !== child) return;
    this.child = undefined;
    this.current = undefined;
    child.lines.close();
    this.failPending(error, child);
    if (terminate) terminateChild(child.process);
  }

  private failPending(error: Error, child?: NativeChild): void {
    for (const [id, pending] of this.pending) {
      if (child === undefined || pending.child === child) {
        this.settlePending(id, pending, error);
      }
    }
  }

  private settlePending(
    id: number,
    pending: Pending,
    result: ITtscGraphSnapshot | Error,
  ): void {
    if (this.pending.get(id) !== pending) return;
    this.pending.delete(id);
    clearTimeout(pending.timer);
    if (pending.signal !== undefined && pending.abort !== undefined) {
      pending.signal.removeEventListener("abort", pending.abort);
    }
    if (result instanceof Error) pending.reject(result);
    else pending.resolve(result);
  }
}

function terminateChild(child: ChildProcessWithoutNullStreams): void {
  if (!child.stdin.destroyed) child.stdin.destroy();
  if (child.exitCode !== null || child.signalCode !== null) return;
  try {
    child.kill();
  } catch {
    return;
  }
  const force = setTimeout(() => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    try {
      child.kill("SIGKILL");
    } catch {
      // The process exited between the liveness check and the signal.
    }
  }, TERMINATION_GRACE_MS);
  force.unref();
  child.once("exit", () => clearTimeout(force));
}

function cancelledError(signal?: AbortSignal, child?: NativeChild): Error {
  const error = new Error(
    `@ttsc/graph: native snapshot request cancelled${abortDetail(signal)}${
      child === undefined ? "" : stderrSuffix(child)
    }`,
  );
  error.name = "AbortError";
  return error;
}

function abortDetail(signal?: AbortSignal): string {
  const reason = signal?.reason;
  if (reason === undefined) return "";
  try {
    return `: ${reason instanceof Error ? reason.message : String(reason)}`;
  } catch {
    return "";
  }
}

function stderrSuffix(child: NativeChild): string {
  const stderr = child.stderr.trim();
  return stderr === "" ? "" : `: ${stderr}`;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
