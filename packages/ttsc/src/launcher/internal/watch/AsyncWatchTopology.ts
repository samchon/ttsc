import path from "node:path";
import { Worker } from "node:worker_threads";

import { SidecarEnvironment } from "../../../compiler/internal/sharedHost/SidecarEnvironment";
import { workerModuleUrl } from "../../../internal/workerModuleUrl";
import type { PluginContentIdentities } from "../../../plugin/internal/source/PluginContentIdentities";
import type { ITtscProjectInputSnapshot } from "../../../structures/internal/ITtscProjectInputSnapshot";
import type { WatchTopologyWorkerProtocol } from "./WatchTopologyWorkerProtocol";

/**
 * Keep one watch topology and its native subscriptions on a worker thread.
 *
 * Case-policy probes, content digests and compiler listings must retain their
 * actual observations. Replacing them with path-only case caches or size/mtime
 * digests can miss directory replacements and source edits. They instead run
 * off the launcher's loop so their cost cannot delay resident-host retirement
 * or queued build decisions (#1758). This moves the cost; it does not remove
 * it. Options and publications are cloned, while callbacks stay on the caller.
 *
 * Await a publication before the build reads its inputs. Moving that baseline
 * past the build could absorb an intervening edit (#1728). Callback messages
 * and completion replies share one FIFO channel, so whenIdle completes after
 * the notifications its barrier observed have reached the launcher (#1756).
 *
 * @evidence contracts/common.md#principled-implementation A dedicated supported worker executes the unchanged topology algorithm; correlated replies settle actual operations and one FIFO channel orders callbacks before their operation's completion.
 * @evidence contracts/common.md#clear-and-simple-design The facade owns transport and worker lifetime, while the synchronous core keeps filesystem policy and watcher ownership together.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Existing native case observations, compiler membership and content proofs remain authoritative; no synchronous barrier or metadata shortcut replaces them.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains off-thread cost, baseline-before-build ordering, message ordering and lifetime failures; public methods state completion and shutdown contracts.
 * @evidence contracts/portability.md#os-neutral-implementation Native joins locate the packaged worker, structured cloning preserves maps and bigint device references, and SidecarEnvironment merges native environment names before worker startup.
 * @evidence contracts/performance.md#efficient-algorithms One thread serves the topology lifetime; each operation clones its selected options or publication bytes and adds one pending-map entry, while the core retains its original filesystem/process costs.
 * @evidence contracts/performance.md#reuse-equivalent-work One worker retains the core's current registrations, listing premises and baseline state across requests; request completion is never treated as a reusable result for another filesystem generation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The facade owns one referenced worker and an uncapped map of in-flight requests. Replies prune entries; worker failure rejects all entries. Close joins worker exit after native subscription close, and failed close terminates and joins the thread while retaining the error. Requests have no implicit deadline.
 */
export class AsyncWatchTopology {
  private readonly worker: Worker;
  private readonly exited: Promise<void>;
  private readonly pending = new Map<
    number,
    { resolve(): void; reject(error: unknown): void }
  >();
  private sequence = 0;
  private failure: unknown;
  private failed = false;
  private terminating = false;
  private closing: Promise<void> | undefined;

  /**
   * Capture data options and start the worker; callbacks remain caller-owned.
   * The optional factory observes worker transport without replacing globals.
   *
   * @evidence contracts/common.md#principled-implementation Only selected cloneable data enters one worker; callback functions stay on this thread and worker events own actual completion.
   * @evidence contracts/common.md#clear-and-simple-design Construction separates option capture, reply dispatch and terminal worker ownership.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The explicit worker factory supplies owned transport without changing globals; the native default requires the real CommonJS packaged entry.
   * @evidence contracts/common.md#meaningful-documentation Prose identifies captured options, callback ownership and the factory's purpose.
   * @evidence contracts/portability.md#os-neutral-implementation The supported module bootstrap uses createRequire with the native CommonJS entry path; inherited execution options and loader hooks remain Node-owned, and native environment names merge before launch.
   * @evidence contracts/performance.md#efficient-algorithms Selection copies fixed option references before workerData cloning; startup and clone costs include option/environment bytes and worker module initialization.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Construction starts a new topology lifetime without borrowing another worker's state.
   * @evidence contracts/performance.md#bound-retention-and-release-resources One referenced worker, its listeners and an exit promise belong to this facade until close or terminal failure; creation failure propagates before ownership transfers.
   */
  public constructor(
    options: WatchTopologyWorkerProtocol.Options,
    private readonly callbacks: WatchTopologyWorkerProtocol.Callbacks,
    createWorker: (options: WatchTopologyWorkerProtocol.Options) => Worker = (
      selected,
    ) =>
      new Worker(
        workerModuleUrl(
          path.join(
            __dirname,
            `watchTopologyWorker${path.extname(__filename)}`,
          ),
        ),
        {
          env: SidecarEnvironment.merge(process.env, selected.env),
          workerData: selected,
        },
      ),
  ) {
    // Callers also carry build callbacks. Select only the core's data options:
    // sending the invocation wholesale would attempt to clone those functions.
    const {
      binary,
      compilerArgsCwd,
      compilerProjectSelections,
      cwd,
      emit,
      env,
      files,
      outDir,
      passthrough,
      pinCompilerProject,
      projectRoot,
      tsconfig,
    } = options;
    this.worker = createWorker({
      binary,
      compilerArgsCwd,
      compilerProjectSelections,
      cwd,
      emit,
      env,
      files,
      outDir,
      passthrough,
      pinCompilerProject,
      projectRoot,
      tsconfig,
    });
    this.worker.on("message", (reply: WatchTopologyWorkerProtocol.Reply) => {
      if ("id" in reply) {
        const waiting = this.pending.get(reply.id);
        if (waiting === undefined) return;
        this.pending.delete(reply.id);
        if (reply.ok) waiting.resolve();
        else waiting.reject(reply.error);
        return;
      }
      switch (reply.event) {
        case "input":
          this.callbacks.onInputChange(reply.change);
          break;
        case "topology":
          this.callbacks.onTopologyChange();
          break;
        case "error":
          this.callbacks.onError(reply.location, reply.error);
          break;
        case "roots":
          this.callbacks.onProjectInputWatchRoots?.(reply.roots);
          break;
        case "unavailable":
          this.callbacks.onProjectInputWatchUnavailable?.(reply.roots);
          break;
      }
    });
    this.worker.on("error", (error) => this.fail(error));
    this.exited = new Promise<void>((resolve) => {
      this.worker.once("exit", (code) => {
        if (
          this.closing === undefined ||
          this.pending.size !== 0 ||
          (code !== 0 && !this.terminating)
        )
          this.fail(
            new Error(`ttsc: watch topology worker exited with code ${code}`),
          );
        resolve();
      });
    });
  }

  /**
   * Reconcile actual compiler membership and wait for its publication.
   *
   * @evidence contracts/common.md#principled-implementation The worker executes the core's actual refresh before replying, so completion does not stand for a predicted membership.
   * @evidence contracts/common.md#clear-and-simple-design This operation frames one refresh and delegates transport correlation to request.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Membership still comes from the core's native compiler-input reader.
   * @evidence contracts/common.md#meaningful-documentation Prose states the membership and publication boundary.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation The method frames a boolean; the worker and core own native execution.
   * @evidence contracts/performance.md#efficient-algorithms Fixed-size framing adds one pending entry; the core retains listing, traversal and hashing costs off-thread.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Every requested refresh executes; listing reuse remains the core's decision.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Correlation remains live until reply or worker failure; no deadline is imposed.
   */
  public refresh(notify: boolean): Promise<void> {
    return this.request({ method: "refresh", notify });
  }

  /**
   * Capture plugin baselines before the caller starts reading or building.
   *
   * @evidence contracts/common.md#principled-implementation Awaited completion follows the core's baseline capture and preserves the supplied record store's separability references through structured cloning.
   * @evidence contracts/common.md#clear-and-simple-design One publication carries inputs and their existing proof store together.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The actual content identity owner still judges every record; transport invents no digest or metadata equivalence.
   * @evidence contracts/common.md#meaningful-documentation Prose states the required pre-build ordering.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Paths and bigint maps are cloned as data; the core owns native interpretation.
   * @evidence contracts/performance.md#efficient-algorithms Framing is fixed structural work and cloning visits input paths and record references; digest and registration work stays with the core.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each publication reaches the core, which owns baseline and listing reuse premises.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Publication data and one pending correlation remain live through completion or worker failure without a size or deadline cap.
   */
  public setExtraInputs(
    inputs: readonly string[],
    identities?: PluginContentIdentities.Store,
  ): Promise<void> {
    return this.request({ method: "setExtraInputs", inputs, identities });
  }

  /**
   * Capture rule-input baselines before the caller consumes those inputs.
   *
   * @evidence contracts/common.md#principled-implementation Completion follows actual declaration normalization, population capture and subscription reconciliation in the core.
   * @evidence contracts/common.md#clear-and-simple-design One operation carries the complete declared snapshot without splitting population and baseline ownership.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The core retains missing-path, alias and empty-population semantics; transport filters no inputs.
   * @evidence contracts/common.md#meaningful-documentation Prose states capture timing relative to consumption.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation The snapshot crosses as data; the core owns filesystem identity and case policy.
   * @evidence contracts/performance.md#efficient-algorithms Cloning visits the snapshot's path text; matching, fingerprinting and registrations keep their owning core costs.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The core decides whether a publication is equivalent; transport reuses no earlier result.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Snapshot bytes and one pending correlation remain live until reply or worker failure without a population cap.
   */
  public setProjectInputs(inputs: ITtscProjectInputSnapshot): Promise<void> {
    return this.request({ method: "setProjectInputs", inputs });
  }

  /**
   * Wait for delivered topology work and its preceding callback messages.
   *
   * @evidence contracts/common.md#principled-implementation The worker's core barrier observes its scheduled owners, and callbacks sent before the completion reply arrive first on the same FIFO channel.
   * @evidence contracts/common.md#clear-and-simple-design One request exposes the core's complete queue ownership instead of duplicating queue flags here.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual queue completion replaces elapsed quiet-time estimates.
   * @evidence contracts/common.md#meaningful-documentation Prose identifies delivered work and callback ordering.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation The operation uses portable MessagePort ordering without a native path or process call.
   * @evidence contracts/performance.md#efficient-algorithms Fixed-size framing adds one correlation; the core checks flags per yielded turn and still pays its pending operations' costs.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each barrier observes current pending work rather than a previous receipt.
   * @evidence contracts/performance.md#bound-retention-and-release-resources One request remains live until idle, close or failure; continuous new work can keep it pending without an implicit deadline.
   */
  public whenIdle(): Promise<void> {
    return this.request({ method: "whenIdle" });
  }

  /**
   * Close subscriptions and join the thread. Repeated calls share retirement;
   * close or worker failures remain rejection even after thread termination.
   *
   * @evidence contracts/common.md#principled-implementation Successful close follows core subscription release, outstanding barrier answers and actual worker exit; failed close terminates and joins the thread while preserving rejection.
   * @evidence contracts/common.md#clear-and-simple-design One retained promise owns idempotent shutdown and finishClose owns its two retirement paths.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Shutdown joins actual thread exit rather than treating a posted close as completion.
   * @evidence contracts/common.md#meaningful-documentation Prose states joined completion, repeated-call sharing and failure retention.
   * @evidence contracts/portability.md#os-neutral-implementation Node's supported worker exit and termination APIs own thread retirement; the core owns backend subscription closure.
   * @evidence contracts/performance.md#efficient-algorithms One close message and shared promise add fixed structural work; subscription traversal, outstanding replies and thread retirement retain delegated costs.
   * @evidence contracts/performance.md#reuse-equivalent-work Every repeated close shares this lifetime's single retirement result, including rejection.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Closure rejects new requests and joins the worker; pending requests settle by replies or terminal failure. Native FSEvents stop errors are suppressed by its existing backend, so thread joining alone cannot certify that optional binding's physical cleanup.
   */
  public close(): Promise<void> {
    this.closing ??= this.finishClose();
    return this.closing;
  }

  private async finishClose(): Promise<void> {
    try {
      await this.request({ method: "close" });
    } catch (error) {
      this.terminating = true;
      await this.worker.terminate();
      await this.exited;
      throw error;
    }
    await this.exited;
    if (this.failed) throw this.failure;
  }

  private request(
    operation: WatchTopologyWorkerProtocol.Operation,
  ): Promise<void> {
    if (this.failed) return Promise.reject(this.failure);
    if (this.closing !== undefined)
      return Promise.reject(new Error("ttsc: watch topology is closing"));
    const id = ++this.sequence;
    return new Promise<void>((resolve, reject) => {
      this.pending.set(id, { reject, resolve });
      try {
        this.worker.postMessage({ ...operation, id });
      } catch (error) {
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  private fail(error: unknown): void {
    if (this.failed) return;
    this.failed = true;
    this.failure = error;
    for (const waiting of this.pending.values()) waiting.reject(error);
    this.pending.clear();
    this.callbacks.onFailure(error);
  }
}
