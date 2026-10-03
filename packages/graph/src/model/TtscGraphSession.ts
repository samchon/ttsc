import type { TtscGraphRequestOptions } from "./TtscGraphRequestOptions";
import type { TtscGraphSessionOptions } from "./TtscGraphSessionOptions";

import { TtscGraphNativeArguments } from "./TtscGraphNativeArguments";
import { TtscGraphLinePeer } from "./TtscGraphLinePeer";
import { TtscGraphProtocol } from "./TtscGraphProtocol";
import { TtscGraphSessionState } from "./TtscGraphSessionState";

import { ensureExecutable } from "../nativeExecutable";
import { resolveGraphBinary } from "../resolveGraphBinary";
import { TtscGraphMemory } from "./TtscGraphMemory";
import { TtscLintDaemon } from "./TtscLintDaemon";
import type { IPublishedArtifacts } from "./IPublishedArtifacts";
import {
  artifactsAreStale,
  publishArtifacts,
  publishArtifactsResident,
} from "./publishedArtifacts";

/**
 * Resident bridge to `ttscgraph serve`.
 *
 * Every graph request first asks the native session for the current disk
 * snapshot. Unchanged requests reuse the existing {@link TtscGraphMemory}; an
 * edited source reuses tsgo's resident Program through `driver.Session`, while
 * config and root-file-set changes force a safe full reload.
 *
 * @evidence contracts/common.md#principled-implementation Validated versioned responses and atomic shard transactions preserve generation consistency while serialized requests correlate native replies by id.
 * @evidence contracts/common.md#clear-and-simple-design This facade owns project/binary and artifact sidecars; the state owns queue/model/shards, the protocol owns generated decoding and the line adapter owns the native child.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Compatible full dumps remain an explicit protocol fallback; malformed or mismatched responses retire the child rather than producing partial trusted facts.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain resident reuse, reload boundaries and artifact ownership, while public methods describe request and shutdown behavior.
 * @evidenceExclude contracts/performance.md#efficient-algorithms graph delegates admission and refresh to the state owner; this facade describes project, binary and artifact sidecar identity.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work graph owns coordination of model/producer reuse and its invalidation decisions.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources graph/close own actual acquisition and retirement; the class declaration describes the owner without a separate lifecycle operation.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Native project resolution and process control are reviewed through graph and close, including their private helpers.
 */
export class TtscGraphSession {
  private readonly cwd: string;
  private readonly tsconfig: string;
  private readonly binary: string;
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
  private readonly daemonIdentities = new Map<string, string>();
  private readonly state: TtscGraphSessionState;
  private readonly shutdown = new AbortController();
  private readonly retiredDaemons = new Set<Promise<void>>();

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
    this.state = new TtscGraphSessionState({
      open: (events) => this.open(events),
      decode: TtscGraphProtocol.decode,
      beforeRequest: (signal) => this.republishArtifacts(signal),
      artifacts: () => this.artifacts === undefined ? undefined : (this.artifacts.file ?? ""),
      close: async () => {
        for (const daemon of this.daemons.values()) this.retireDaemon(daemon);
        this.daemons.clear();
        this.daemonIdentities.clear();
        const results = await Promise.allSettled(this.retiredDaemons);
        const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected").map((result) => result.reason);
        if (failures.length > 0) throw new AggregateError(failures, "@ttsc/graph: sidecar shutdown failed");
      },
    });
  }

  /**
   * Return a graph for the current disk snapshot, serialized per tool call.
   *
   * Cancellation rejects a queued request before it starts or retires its
   * active child. Closed sessions reject new requests and do not respawn.
   *
   * @evidence contracts/common.md#principled-implementation Queue serialization refreshes one current native generation, and single-settlement callbacks preserve request results across cancellation races.
   * @evidence contracts/common.md#clear-and-simple-design The state owner handles admission, cancellation, response semantics and model replacement; facade callbacks synchronize artifacts and open the actual native transport.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A cancelled or closed request cannot be fulfilled from fabricated empty facts or restart a disposed session.
   * @evidence contracts/common.md#meaningful-documentation Native prose states serialized snapshot timing, queued/active cancellation and closed-session behavior.
   * @evidence contracts/portability.md#os-neutral-implementation Native binary resolution, argv spawning and Node termination APIs own host differences; project coordinates are never passed through a shell.
   * @evidence contracts/performance.md#efficient-algorithms An unchanged request validates artifact inputs and a native frame, then returns the resident model; changed frames additionally validate shards and rebuild model indexes.
   * @evidence contracts/performance.md#reuse-equivalent-work Current memory is shared only after the native producer confirms unchanged inputs; changed generations replace it and changed artifacts are republished before requesting facts.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The session owns one graph child, current model, shard map and current publisher sidecars; republishing retires removed publishers, while pending/queued demand grows with submitted requests and completion/cancellation remove registrations.
   */
  public graph(options: TtscGraphRequestOptions = {}): Promise<TtscGraphMemory> {
    return this.state.graph(options);
  }

  /**
   * Close the native session. Safe to call more than once.
   *
   * Retires artifact sidecars and rejects pending native requests. Queued
   * requests observe the closed state before they can create another child.
   *
   * @evidence contracts/common.md#principled-implementation The closed flag precedes sidecar disposal and child failure, so every pending or subsequent native operation observes retired ownership.
   * @evidence contracts/common.md#clear-and-simple-design The explicit close path reuses failChild/failPending cleanup instead of a second cancellation implementation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Disposing a session cannot trigger a compensating respawn or pretend outstanding requests succeeded.
   * @evidence contracts/common.md#meaningful-documentation Native prose documents idempotence, pending rejection and queued-request behavior.
   * @evidence contracts/portability.md#os-neutral-implementation Node child termination ends stdin, signals the process and escalates after a grace period without platform shell commands.
   * @evidence contracts/performance.md#efficient-algorithms Shutdown visits sidecars and pending replies once; a delayed force-kill timer is cancelled when the child exits.
   * @evidence contracts/performance.md#reuse-equivalent-work Closure ends this owner's permission to reuse native Program, model and sidecars; subsequent graph calls reject.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Sidecars are cleared, native readers and reply listeners are removed, current model/shards are released with child retirement, and termination owns its finite grace timer.
   */
  public close(): Promise<void> {
    this.shutdown.abort(new Error("@ttsc/graph: native session closed"));
    return this.state.close();
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
    if (!this.state.hasPeer() || this.artifacts === undefined) return;
    if (!artifactsAreStale(this.artifacts)) return;
    const publishers = new Set<string>();
    const next = await publishArtifactsResident(
      { cwd: this.cwd, tsconfig: this.tsconfig, signal: this.shutdown.signal },
      (plugin) => {
        publishers.add(plugin.binary);
        return this.daemon(plugin);
      },
    );
    for (const [binary, daemon] of this.daemons) {
      if (publishers.has(binary)) continue;
      const closing = this.retireDaemon(daemon);
      await closing;
      this.daemons.delete(binary);
      this.daemonIdentities.delete(binary);
    }
    // The new answer is taken whatever it says, including that the project now
    // publishes nothing. Keeping the old set on a `null` would be guessing that
    // the publisher failed rather than that it was removed, and guessing wrong
    // in that direction is the unrecoverable one: a session that answers with
    // artifacts from a plugin the user deleted keeps doing so until it is
    // restarted, while a transient failure is repaired by the next edit.
    this.artifacts = next;
  }

  /** The open sidecar for one plugin, opened on first use. */
  private async daemon(plugin: {
    binary: string;
    manifest: string;
    projectContext?: string;
  }): Promise<TtscLintDaemon> {
    this.shutdown.signal.throwIfAborted();
    const open = this.daemons.get(plugin.binary);
    const identity = JSON.stringify([plugin.manifest, plugin.projectContext]);
    if (
      open !== undefined &&
      this.daemonIdentities.get(plugin.binary) === identity
    )
      return open;
    if (open !== undefined) {
      const closing = this.retireDaemon(open);
      await closing;
    }
    this.shutdown.signal.throwIfAborted();
    const created = new TtscLintDaemon(plugin, this.cwd, this.tsconfig);
    this.daemons.set(plugin.binary, created);
    this.daemonIdentities.set(plugin.binary, identity);
    return created;
  }

  /** Keep failures visible to shutdown, releasing fulfilled historical owners. */
  private retireDaemon(daemon: TtscLintDaemon): Promise<void> {
    const closing = daemon.close();
    this.retiredDaemons.add(closing);
    void closing.then(() => this.retiredDaemons.delete(closing), () => undefined);
    return closing;
  }

  private open(events: TtscGraphLinePeer.Events): TtscGraphLinePeer.Connection {
    const artifacts = publishArtifacts({ cwd: this.cwd, tsconfig: this.tsconfig });
    this.artifacts = artifacts;
    return TtscGraphLinePeer.open(this.binary,
      TtscGraphNativeArguments.serve(this.cwd, this.tsconfig, artifacts.file), events, { stderr: "capture" });
  }
}
