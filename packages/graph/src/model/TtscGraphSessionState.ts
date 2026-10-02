import { ITtscGraphSnapshot } from "../structures/ITtscGraphSnapshot";
import { TtscGraphLinePeer } from "./TtscGraphLinePeer";
import { TtscGraphMemory } from "./TtscGraphMemory";
import { TtscGraphShardStore } from "./TtscGraphShardStore";
import { DUMP_SCHEMA_VERSION } from "./loadGraph";

const GRAPH_SNAPSHOT_PROTOCOL_VERSION = 1;

interface Pending {
  child: TtscGraphLinePeer.Connection;
  resolve: (response: ITtscGraphSnapshot) => void;
  reject: (error: Error) => void;
  signal?: AbortSignal;
  abort?: () => void;
}

/**
 * Queue, request correlation and generation ownership for one resident graph.
 *
 * The host supplies artifact synchronization and validated line decoding;
 * this owner accepts typed envelopes, atomically replaces graph generations,
 * and retires a peer when its transport or generation cannot be trusted.
 * It is internal to the graph facade, not an alternate public session API.
 *
 * @evidence contracts/common.md#principled-implementation Serialized admission and identity-checked reply settlement protect one atomic shard generation across abort, close and peer replacement.
 * @evidence contracts/common.md#clear-and-simple-design Artifact discovery and generated schema decoding remain host responsibilities; this owner controls queue, pending replies, memory and shard retirement.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Typed receive requires validated envelopes from the actual decoder; it supplies no schema substitute or fabricated fallback facts.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the validated-input premise and internal ownership; receive and failure events distinguish peer identity and lifecycle effects.
 * @evidenceExclude contracts/performance.md#efficient-algorithms graph/receive/close own admission, frame processing and retirement; this declaration groups their retained state.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work graph/receive/close establish continued peer/model reuse, not the class descriptor independently.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources graph/receive/close control acquisition and release; the class declaration adds no separate lifecycle transition.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation keeps queue and pending-request state in memory and reaches the process only through the Host and Connection operations it is given.
 */
export class TtscGraphSessionState {
  private child: TtscGraphLinePeer.Connection | undefined;
  private nextId = 0;
  private readonly pending = new Map<number, Pending>();
  private queue: Promise<void> = Promise.resolve();
  private current: TtscGraphMemory | undefined;
  private shardStore = new TtscGraphShardStore();
  private closed = false;
  private closing: Promise<void> | undefined;
  private readonly retirements = new Set<Promise<void>>();

  public constructor(private readonly host: TtscGraphSessionState.Host) {}

  /**
   * Whether artifact refresh currently has a peer to update.
   *
   * @evidence contracts/common.md#principled-implementation The presence of owned peer state distinguishes an active publication target from a yet-unopened or retired session.
   * @evidence contracts/common.md#clear-and-simple-design One read-only query lets the artifact facade retain its original live-peer refresh precondition.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Ownership is observed directly rather than guessed from previous artifact values or a clock.
   * @evidence contracts/common.md#meaningful-documentation The headline states why the facade asks this ownership question.
   * @evidence contracts/performance.md#efficient-algorithms This constant-time reference check scans no pending or shard population.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The query returns current ownership and coordinates no completed computation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources It acquires or releases nothing; graph and close own the queried peer.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation reads one field.
   */
  public hasPeer(): boolean { return this.child !== undefined; }

  /**
   * Refresh one graph, rejecting queued cancellation without disturbing its head.
   *
   * @evidence contracts/common.md#principled-implementation Promise serialization and single-settlement guards preserve one live native generation and independent queued abort ownership.
   * @evidence contracts/common.md#clear-and-simple-design Admission owns queued cancellation while refresh owns artifact synchronization, semantic checks and atomic model replacement.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Cancellation retires active ownership or rejects before admission; it never fabricates an empty successful result.
   * @evidence contracts/common.md#meaningful-documentation The headline distinguishes queued cancellation from active peer retirement; typed receive separately states its validation premise.
   * @evidence contracts/performance.md#efficient-algorithms Unchanged requests admit and correlate one frame then reuse memory; changed transactions additionally validate shards and rebuild graph indexes, proportional to their facts.
   * @evidence contracts/performance.md#reuse-equivalent-work Current memory is reusable only when the validated native envelope says unchanged; retirement clears memory/shards and a changed generation replaces them atomically.
   * @evidence contracts/performance.md#bound-retention-and-release-resources One current peer/model/store is retained; pending and queued tasks grow with caller demand, and settlement or cancellation removes abort listeners and pending entries.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation queues a request and calls injected host operations; it opens no file or process itself.
   */
  public graph(
    options: { signal?: AbortSignal } = {},
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
   * @evidence contracts/performance.md#efficient-algorithms Shutdown invokes the artifact host once and visits pending owners once; the actual peer adapter owns any native kill timer.
   * @evidence contracts/performance.md#reuse-equivalent-work Closure ends this owner's permission to reuse native Program, model and sidecars; subsequent graph calls reject.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The host retires artifact sidecars, pending listeners are removed, current model/shards are cleared and peer.close transfers reader/process disposal to its actual adapter.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation marks the state closed and calls the injected host and peer close operations; the process work lives there.
   */
  public close(): Promise<void> {
    if (this.closing !== undefined) return this.closing;
    this.closed = true;
    const hostClose = Promise.resolve().then(() => this.host.close());
    void hostClose.catch(() => undefined);
    const error = new Error("@ttsc/graph: native session closed");
    if (this.child !== undefined) this.failChild(this.child, error);
    else this.failPending(error);
    this.closing = (async () => {
      await this.queue;
      const results = await Promise.allSettled([hostClose, ...this.retirements]);
      const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected").map((result) => result.reason);
      if (failures.length > 0) throw new AggregateError(failures, "@ttsc/graph: session shutdown failed");
    })();
    void this.closing.catch(() => undefined);
    return this.closing;
  }

  private async refresh(signal?: AbortSignal): Promise<TtscGraphMemory> {
    if (this.closed) throw new Error("@ttsc/graph: native session is closed");
    await Promise.all(this.retirements);
    if (this.closed) throw new Error("@ttsc/graph: native session is closed");
    // The protocol version and envelope shape were settled by the host decoder,
    // before this frame was ever routed here.
    await this.host.beforeRequest(signal);
    if (this.closed) throw new Error("@ttsc/graph: native session is closed");
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
      child.write(
        `${JSON.stringify({
          id,
          graphSnapshotVersion: GRAPH_SNAPSHOT_PROTOCOL_VERSION,
          // Empty when the project publishes nothing, which withdraws whatever
          // the server holds: a publisher the user removed must stop being
          // answered with, and omitting the field instead would say only that
          // this client has no opinion. Omitted only before a child exists,
          // which no request reaches.
          artifacts:
            this.host.artifacts(),
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

  private ensureChild(): TtscGraphLinePeer.Connection {
    if (this.closed) throw new Error("@ttsc/graph: native session is closed");
    if (this.child !== undefined && this.child.alive()) return this.child;
    const child = this.host.open({
      line: (line) => {
        if (this.child !== child) return;
        try {
          this.receive(child, this.host.decode(line));
        } catch (error) {
          this.failChild(child, asError(error));
        }
      },
      error: (error) => this.failChild(child, new Error(`@ttsc/graph: native session failed: ${error.message}`)),
      exit: (code, signal) => this.failChild(child, new Error(
        `@ttsc/graph: native session exited (code=${String(code)}, signal=${String(signal)})${stderrSuffix(child)}`,
      )),
    });
    this.child = child;
    return child;
  }

  /**
   * Admit a decoded envelope from the current peer; stale peers cannot publish.
   *
   * Callers must supply the actual decoder's validated envelope. This operation
   * checks body schema agreement and correlation; it does not substitute for
   * full envelope shape validation.
   *
   * @evidence contracts/common.md#principled-implementation Peer identity precedes body compatibility and request-id lookup; only the matching pending owner may receive this typed envelope.
   * @evidence contracts/common.md#clear-and-simple-design Wire shape belongs to the decoder; body version and pending correlation belong to the state that will consume its generation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown request ids cannot settle the live caller, and incompatible body versions retire ownership rather than trusting absent fields.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the validated-input premise and the checks this operation actually performs.
   * @evidence contracts/performance.md#efficient-algorithms Schema checks and pending-map lookup are constant-time before one settlement; body facts are processed by refresh only for the matching request.
   * @evidence contracts/performance.md#reuse-equivalent-work This routes a validated frame; refresh alone permits memory reuse after an unchanged response, and schema failure clears the reusable peer generation.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Settlement removes exactly one pending entry and its abort listener; mismatch retirement clears this peer's current model/store and fails its pending owners.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation correlates a decoded envelope with its pending request in memory.
   */
  public receive(child: TtscGraphLinePeer.Connection, response: ITtscGraphSnapshot): void {
    if (this.child !== child) return;
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

  private failChild(child: TtscGraphLinePeer.Connection, error: Error): void {
    if (this.child !== child) return;
    this.child = undefined;
    this.current = undefined;
    this.shardStore = new TtscGraphShardStore();
    child.close(false);
    this.failPending(error, child);
    // Even an exited process must join its stdio before release is known.
    const retirement = Promise.resolve(child.close(true));
    this.retirements.add(retirement);
    void retirement.then(() => this.retirements.delete(retirement), () => undefined);
  }

  private failPending(error: Error, child?: TtscGraphLinePeer.Connection): void {
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

/** Host operations separate compiler/schema production from state transitions. */
export namespace TtscGraphSessionState {
  /**
   * Actual session dependencies, provided once by its facade.
   *
   * @evidence contracts/common.md#principled-implementation Host capability identity is fixed for one state owner; artifact synchronization and decoding remain actual facade dependencies.
   * @evidence contracts/common.md#clear-and-simple-design The signature delegates this capability to the facade while state owns request correlation and lifecycle.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The declared operation requires the real capability; no canned response or substitute validator belongs to this contract.
   * @evidence contracts/common.md#meaningful-documentation The native member comment states the capability and its ownership or optional-state premise.
   * @evidenceExclude contracts/performance.md#efficient-algorithms This capability signature declares its result; its actual host implementation and graph operation own processing cost.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The signature describes a dependency; graph and actual artifact owner establish whether previous work may be reused.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The signature acquires no resource itself; its actual implementation and state close control lifetime.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation signature only: the implementer owns any path or process work.
   */
  export interface Host {
    /**
     * Open the native peer for the current published artifacts.
     *
     * @evidence contracts/common.md#principled-implementation Opening supplies one owned connection and its event callbacks for the current artifact answer.
     * @evidence contracts/common.md#clear-and-simple-design The signature delegates this capability to the facade while state owns request correlation and lifecycle.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts The declared operation requires the real capability; no canned response or substitute validator belongs to this contract.
     * @evidence contracts/common.md#meaningful-documentation The native member comment states the capability and its ownership or optional-state premise.
     * @evidenceExclude contracts/performance.md#efficient-algorithms This capability signature declares its result; its actual host implementation and graph operation own processing cost.
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work The signature describes a dependency; graph and actual artifact owner establish whether previous work may be reused.
     * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The signature acquires no resource itself; its actual implementation and state close control lifetime.
     * @evidenceExclude contracts/portability.md#os-neutral-implementation signature only: the implementer owns any path or process work.
     */
    open(events: TtscGraphLinePeer.Events): TtscGraphLinePeer.Connection;

    /**
     * Decode one complete line with the installed generated envelope validator.
     *
     * @evidence contracts/common.md#principled-implementation The decoder capability requires JSON/protocol/full-envelope validation before returning a typed frame.
     * @evidence contracts/common.md#clear-and-simple-design The signature delegates this capability to the facade while state owns request correlation and lifecycle.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts The declared operation requires the real capability; no canned response or substitute validator belongs to this contract.
     * @evidence contracts/common.md#meaningful-documentation The native member comment states the capability and its ownership or optional-state premise.
     * @evidenceExclude contracts/performance.md#efficient-algorithms This capability signature declares its result; its actual host implementation and graph operation own processing cost.
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work The signature describes a dependency; graph and actual artifact owner establish whether previous work may be reused.
     * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The signature acquires no resource itself; its actual implementation and state close control lifetime.
     * @evidenceExclude contracts/portability.md#os-neutral-implementation signature only: the implementer owns any path or process work.
     */
    decode(line: string): ITtscGraphSnapshot;

    /**
     * Synchronize changed artifact inputs before a refresh.
     *
     * @evidence contracts/common.md#principled-implementation The asynchronous precondition completes artifact synchronization before any graph request is written.
     * @evidence contracts/common.md#clear-and-simple-design The signature delegates this capability to the facade while state owns request correlation and lifecycle.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts The declared operation requires the real capability; no canned response or substitute validator belongs to this contract.
     * @evidence contracts/common.md#meaningful-documentation The native member comment states the capability and its ownership or optional-state premise.
     * @evidenceExclude contracts/performance.md#efficient-algorithms This capability signature declares its result; its actual host implementation and graph operation own processing cost.
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work The signature describes a dependency; graph and actual artifact owner establish whether previous work may be reused.
     * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The signature acquires no resource itself; its actual implementation and state close control lifetime.
     * @evidenceExclude contracts/portability.md#os-neutral-implementation signature only: the implementer owns any path or process work.
     */
    beforeRequest(signal?: AbortSignal): Promise<void>;

    /**
     * Current artifact answer; an empty string explicitly withdraws it.
     *
     * @evidence contracts/common.md#principled-implementation Undefined, empty and file-path artifact answers retain their distinct wire meanings.
     * @evidence contracts/common.md#clear-and-simple-design The signature delegates this capability to the facade while state owns request correlation and lifecycle.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts The declared operation requires the real capability; no canned response or substitute validator belongs to this contract.
     * @evidence contracts/common.md#meaningful-documentation The native member comment states the capability and its ownership or optional-state premise.
     * @evidenceExclude contracts/performance.md#efficient-algorithms This capability signature declares its result; its actual host implementation and graph operation own processing cost.
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work The signature describes a dependency; graph and actual artifact owner establish whether previous work may be reused.
     * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The signature acquires no resource itself; its actual implementation and state close control lifetime.
     * @evidenceExclude contracts/portability.md#os-neutral-implementation signature only: the implementer owns any path or process work.
     */
    artifacts(): string | undefined;

    /**
     * Retire sidecars owned by this session.
     *
     * @evidence contracts/common.md#principled-implementation Host closure relinquishes sidecars when terminal state ends their permission to remain live.
     * @evidence contracts/common.md#clear-and-simple-design The signature delegates this capability to the facade while state owns request correlation and lifecycle.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts The declared operation requires the real capability; no canned response or substitute validator belongs to this contract.
     * @evidence contracts/common.md#meaningful-documentation The native member comment states the capability and its ownership or optional-state premise.
     * @evidenceExclude contracts/performance.md#efficient-algorithms This capability signature declares its result; its actual host implementation and graph operation own processing cost.
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work The signature describes a dependency; graph and actual artifact owner establish whether previous work may be reused.
     * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The signature acquires no resource itself; its actual implementation and state close control lifetime.
     * @evidenceExclude contracts/portability.md#os-neutral-implementation signature only: the implementer owns any path or process work.
     */
    close(): void | Promise<void>;
  }
}
function cancelledError(signal?: AbortSignal, child?: TtscGraphLinePeer.Connection): Error {
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

function stderrSuffix(child: TtscGraphLinePeer.Connection): string {
  const stderr = child.stderr.trim();
  return stderr === "" ? "" : `: ${stderr}`;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
