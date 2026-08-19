import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import readline from "node:readline";
import typia from "typia";

import { ensureExecutable } from "../nativeExecutable";
import { resolveGraphBinary } from "../resolveGraphBinary";
import { ITtscGraphSnapshot } from "../structures/ITtscGraphSnapshot";
import { TtscGraphMemory } from "./TtscGraphMemory";
import { TtscGraphShardStore } from "./TtscGraphShardStore";
import { TtscLintDaemon } from "./TtscLintDaemon";
import { DUMP_SCHEMA_VERSION } from "./loadGraph";
import {
  type IPublishedArtifacts,
  artifactsAreStale,
  publishArtifacts,
  publishArtifactsResident,
} from "./publishedArtifacts";

/**
 * The serve protocol version this client speaks.
 *
 * Keep it equal to `serveProtocolVersion` in
 * `packages/ttsc/cmd/ttscgraph/serve.go`. The two are hand-synchronized, and
 * `serve_protocol_version_matches_the_typescript_client_test.go` reads this
 * constant out of this file and fails if the pair drifts.
 */
const PROTOCOL_VERSION = 1;
const GRAPH_SNAPSHOT_PROTOCOL_VERSION = 1;
const TERMINATION_GRACE_MS = 1_000;

interface Pending {
  child: NativeChild;
  resolve: (response: ITtscGraphSnapshot) => void;
  reject: (error: Error) => void;
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
  private child: NativeChild | undefined;
  private nextId = 0;
  private readonly pending = new Map<number, Pending>();
  private queue: Promise<void> = Promise.resolve();
  private current: TtscGraphMemory | undefined;
  private shardStore = new TtscGraphShardStore();
  /**
   * The artifact answer the resident child was last handed, and the state of
   * the inputs it came from.
   *
   * `undefined` only before a child exists. Once one does this is always an
   * answer, including the answer that the project publishes nothing — which
   * still carries inputs, so that adding a publisher is something a running
   * session can notice.
   */
  private artifacts: IPublishedArtifacts | undefined;
  /**
   * One resident `@ttsc/lint` sidecar per plugin binary, opened lazily.
   *
   * A republish asks two verbs of every configured publisher, and a session
   * republishes whenever a document moves. Held open, those questions cost a
   * request each instead of a process, a plugin load and a configuration
   * evaluation each. Keyed by binary because that is what a daemon is: the same
   * binary answering for the same project.
   */
  private readonly daemons = new Map<string, TtscLintDaemon>();
  private closed = false;

  public constructor(options: TtscGraphSessionOptions) {
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
    // The sidecars outlive nothing. A daemon is a child process this session
    // opened, and a session that closed without stopping them would leave one
    // resident Program per configured publisher alive for as long as the parent
    // ran.
    for (const daemon of this.daemons.values()) daemon.close();
    this.daemons.clear();
    const error = new Error("@ttsc/graph: native session closed");
    if (this.child !== undefined) this.failChild(this.child, error);
    else this.failPending(error);
  }

  private async refresh(signal?: AbortSignal): Promise<TtscGraphMemory> {
    // The protocol version and the envelope shape were both settled in onLine,
    // before this frame was ever routed here.
    await this.republishArtifacts(signal);
    const response = await this.request(signal);
    this.assertResponseSemantics(response);
    if (response.error !== undefined) {
      throw new Error(`@ttsc/graph: ${response.error}`);
    }
    if (response.changed) {
      if (response.snapshot !== undefined) {
        try {
          this.current = TtscGraphMemory.from(
            this.shardStore.apply(response.snapshot),
          );
        } catch (error) {
          const failure = asError(error);
          if (this.child !== undefined) this.failChild(this.child, failure);
          throw failure;
        }
      } else if (response.dump !== undefined) {
        // A serve-protocol-v1 binary predating graph shard negotiation ignores
        // the optional request field and retains the complete-dump response.
        this.current = TtscGraphMemory.from(response.dump);
      } else {
        throw new Error(
          `@ttsc/graph: native ${response.mode} response omitted both graph snapshot protocol v${String(GRAPH_SNAPSHOT_PROTOCOL_VERSION)} data and a compatible dump`,
        );
      }
    }
    if (this.current === undefined) {
      throw new Error(
        "@ttsc/graph: native session returned no initial graph snapshot",
      );
    }
    return this.current;
  }

  private assertResponseSemantics(response: ITtscGraphSnapshot): void {
    const bodies =
      Number(response.dump !== undefined) +
      Number(response.snapshot !== undefined);
    let problem: string | undefined;
    if (response.error !== undefined) {
      if (response.mode !== "error" || response.changed || bodies !== 0) {
        problem = "an error response carried snapshot state";
      }
    } else if (response.mode === "error") {
      problem = "an error-mode response omitted its error";
    } else if (response.changed) {
      if (response.mode === "unchanged" || bodies !== 1) {
        problem = "a changed response did not carry exactly one snapshot body";
      }
    } else if (response.mode !== "unchanged" || bodies !== 0) {
      problem = "an unchanged response carried changed mode or snapshot state";
    }
    if (problem === undefined) return;
    const error = new Error(`@ttsc/graph: native session returned ${problem}`);
    if (this.child !== undefined) this.failChild(this.child, error);
    throw error;
  }

  /**
   * Re-derive the artifact set when the documents or configuration behind it
   * moved, before the request that would otherwise answer with the old one.
   *
   * A resident session is invalidated by the compiler's own build universe, and
   * none of this is in it: the documents a rule reads are not Program inputs,
   * which is the property that keeps a Markdown edit from costing a typecheck.
   * The cost of that property is that nothing else notices the edit at all, so
   * this is what notices it.
   *
   * Only the overlay is replaced. The child is not restarted and the Program is
   * not reloaded — the native session compares the file it is handed against
   * the one it applied, and re-projects the resident program when they differ.
   *
   * Asked of sidecars this session keeps open, and awaited rather than blocking
   * the event loop. A republish still costs the rule a Program — the daemon is
   * told to drop its warm one, because the sources a claim activates against
   * have been edited too — but not a process, a plugin load and a configuration
   * evaluation per verb. An already-cancelled request does not start one.
   */
  private async republishArtifacts(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return;
    // A child yet to be spawned publishes on the way up, so there is nothing
    // here to keep fresh until one does.
    if (this.child === undefined || this.artifacts === undefined) return;
    if (!artifactsAreStale(this.artifacts)) return;
    const next = await publishArtifactsResident(
      { cwd: this.cwd, tsconfig: this.tsconfig },
      (plugin) => this.daemon(plugin),
    );
    // The new answer is taken whatever it says, including that the project now
    // publishes nothing. Keeping the old set on a `null` would be guessing that
    // the publisher failed rather than that it was removed, and guessing wrong
    // in that direction is the unrecoverable one: a session that answers with
    // artifacts from a plugin the user deleted keeps doing so until it is
    // restarted, while a transient failure is repaired by the next edit.
    this.artifacts = next;
  }

  /** The open sidecar for one plugin, opened on first use. */
  private daemon(plugin: {
    binary: string;
    manifest: string;
    projectContext?: string;
  }): TtscLintDaemon {
    const open = this.daemons.get(plugin.binary);
    if (open !== undefined) return open;
    const created = new TtscLintDaemon(plugin, this.cwd, this.tsconfig);
    this.daemons.set(plugin.binary, created);
    return created;
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
        signal,
      };
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
      child.process.stdin.write(
        `${JSON.stringify({
          id,
          graphSnapshotVersion: GRAPH_SNAPSHOT_PROTOCOL_VERSION,
          // Empty when the project publishes nothing, which withdraws whatever
          // the server holds: a publisher the user removed must stop being
          // answered with, and omitting the field instead would say only that
          // this client has no opinion. Omitted only before a child exists,
          // which no request reaches.
          artifacts:
            this.artifacts === undefined
              ? undefined
              : (this.artifacts.file ?? ""),
        })}\n`,
        (error) => {
          if (error === null || error === undefined) return;
          if (this.pending.get(id) !== pending) return;
          this.failChild(
            child,
            new Error(
              `@ttsc/graph: could not request native snapshot: ${error.message}`,
            ),
          );
        },
      );
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
    const artifacts = publishArtifacts({
      cwd: this.cwd,
      tsconfig: this.tsconfig,
    });
    this.artifacts = artifacts;
    const process = spawn(
      this.binary,
      [
        "serve",
        "--cwd",
        this.cwd,
        "--tsconfig",
        this.tsconfig,
        ...(artifacts.file === null ? [] : ["--artifacts", artifacts.file]),
      ],
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
      (response.dump !== undefined &&
        response.dump.provenance.schemaVersion !== DUMP_SCHEMA_VERSION) ||
      (response.snapshot !== undefined &&
        response.snapshot.schemaVersion !== DUMP_SCHEMA_VERSION)
    ) {
      // Session-wide, for the same reason the protocol mismatch above is: it is
      // the wrong binary, not one bad frame.
      this.failChild(
        child,
        new Error(
          `@ttsc/graph: ttscgraph sends dump schema v${String(
            response.dump?.provenance.schemaVersion ??
              response.snapshot?.schemaVersion,
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
    this.shardStore = new TtscGraphShardStore();
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
