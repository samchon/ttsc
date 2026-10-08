import type { SpawnSyncOptions, SpawnSyncReturns } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { serialize } from "node:v8";

import { OwnedNativeProcess } from "../internal/OwnedNativeProcess";
import { serializeCompilerError } from "../internal/serializeCompilerError";
import type { ITtscCapabilityPlugin } from "./ITtscCapabilityPlugin";
import { receiveCapabilityFailure } from "./internal/receiveCapabilityFailure";

/**
 * Own asynchronous capability discovery and its opaque freshness proofs.
 * The same worker executes the existing synchronous resolver and keeps each
 * original proof closure. Its native commands are relayed to a joined process
 * supervisor, so cancellation unwinds build cleanup rather than killing the
 * resolver thread while it holds a lease.
 *
 * @evidence contracts/common.md#principled-implementation Serial worker requests preserve the original resolver and proof objects; command containment completes before cancellation resumes their synchronous stacks.
 * @evidence contracts/common.md#clear-and-simple-design This owner controls admission, worker RPC, opaque proof handles and shutdown; the worker owns synchronous discovery and the native owner controls process trees.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No consumer inventory replaces resolver authority and no warmup, altered timeout or uncontained fallback hides a cold producer.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains proof lifetime, cancellation cleanup and the independent native process owner.
 * @evidence contracts/portability.md#os-neutral-implementation The compiled worker uses the SDK's CommonJS file layout, cloned environments and platform helper resolution rather than consumer-specific paths.
 * @evidence contracts/performance.md#efficient-algorithms One worker serves serialized requests and retains original proof closures; command output serialization scales with returned bytes and request admission grows with submitted demand.
 * @evidence contracts/performance.md#reuse-equivalent-work Worker reuse retains validated SDK caches but every resolve and currentness request still calls its original authority; proof handles never transfer freshness between generations.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Explicit release drops proof handles. Close aborts admitted work, joins command supervisors and waits for worker exit; private command exchange storage is removed after its request settles.
 */
export class CapabilityPluginResolver {
  private worker: Worker | undefined;
  private queue: Promise<void> = Promise.resolve();
  private nextId = 0;
  private generation = 0;
  private closed = false;
  private closing: Promise<void> | undefined;
  private readonly controllers = new Set<AbortController>();
  private readonly native = new Set<Promise<unknown>>();
  private readonly failures: unknown[] = [];
  private readonly exits = new Map<Worker, Promise<void>>();

  /**
   * Resolve through the SDK owner, retaining this exact answer's opaque proof.
   *
   * @evidence contracts/common.md#principled-implementation The original resolver creates the answer and closure; worker-generation-qualified handles prevent a restarted worker from reinterpreting an earlier proof number.
   * @evidence contracts/common.md#clear-and-simple-design Returned currentness and release callbacks retain one answer while the owner serializes all worker operations.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Discovery and currentness execute the existing authority instead of substituting an inventory or inferring freshness from a cache path.
   * @evidence contracts/common.md#meaningful-documentation The method describes retained opaque ownership; member types distinguish asynchronous proof queries and release.
   * @evidence contracts/portability.md#os-neutral-implementation Cloned options and environment reach the packaged Node worker; native commands use the separate platform supervisor.
   * @evidence contracts/performance.md#efficient-algorithms Resolution cost remains with the original resolver; the RPC copies returned plugin metadata and retains one closure per unreleased answer.
   * @evidence contracts/performance.md#reuse-equivalent-work Every currentness query calls the original closure in its original worker generation; release or worker loss makes that proof unusable.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Explicit release removes the worker proof, while close clears all remaining proofs after cancelling and joining admitted work.
   */
  public async resolve(
    options: { capability: string; cwd?: string; tsconfig?: string },
    request: { signal?: AbortSignal } = {},
  ): Promise<CapabilityPluginResolver.Resolution> {
    const value = await this.request({ kind: "resolve", options }, request.signal) as {
      handle: number; generation: number; status: "resolved" | "unavailable"; plugins: ITtscCapabilityPlugin[];
    };
    let released = false;
    return {
      status: value.status,
      plugins: value.plugins,
      isCurrent: async ({ signal } = {}) => released || this.closed ? false : await this.request({ kind: "current", handle: value.handle, generation: value.generation }, signal) as boolean,
      release: async () => {
        if (released) return;
        released = true;
        if (!this.closed) await this.request({ kind: "release", handle: value.handle, generation: value.generation });
      },
    };
  }

  /**
   * Execute an admitted publisher verb with the same native lifetime owner.
   *
   * @evidence contracts/common.md#principled-implementation Admission checks terminal ownership before registering a linked controller; the native owner supplies actual joined command outcomes.
   * @evidence contracts/common.md#clear-and-simple-design This method links caller cancellation and owner shutdown to one native operation and removes both links on settlement.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No synchronous fallback bypasses native containment when a publisher cannot use its resident daemon.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies publisher execution and the shared lifetime owner; option support is enforced by that native owner.
   * @evidence contracts/portability.md#os-neutral-implementation Exact argv and options reach the platform supervisor through OwnedNativeProcess rather than shell reconstruction in this method.
   * @evidence contracts/performance.md#efficient-algorithms Admission and retirement use sets with one operation entry; output costs belong to the native operation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Publisher verbs can have effects and must execute per admitted request.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Close can abort every registered operation, waits for its real completion, and retains non-cancellation failures instead of silently certifying clean shutdown.
   */
  public runCommand(
    command: string,
    args: readonly string[],
    options: SpawnSyncOptions,
    request: { signal?: AbortSignal } = {},
  ): Promise<SpawnSyncReturns<string | Buffer>> {
    if (this.closed) return Promise.reject(new Error("ttsc: capability resolver is closed"));
    const controller = new AbortController();
    this.controllers.add(controller);
    const abort = () => controller.abort(request.signal?.reason);
    request.signal?.addEventListener("abort", abort, { once: true });
    if (request.signal?.aborted) abort();
    const operation = OwnedNativeProcess.run(command, args, options, controller.signal,
      (state) => { if (state === "unknown") this.closed = true; });
    this.native.add(operation);
    void operation.catch((error: unknown) => {
      if (!controller.signal.aborted || error !== controller.signal.reason)
        this.rememberFailure(error);
    });
    return operation.finally(() => {
      this.native.delete(operation);
      this.controllers.delete(controller);
      request.signal?.removeEventListener("abort", abort);
    });
  }

  /**
   * Withdraw all admission and join native owners before releasing the worker.
   *
   * @evidence contracts/common.md#principled-implementation Terminal admission is set synchronously, then cancellation unwinds request cleanup before idle worker shutdown; every worker exit is joined even after an error event.
   * @evidence contracts/common.md#clear-and-simple-design One memoized shutdown promise orders queue drain, native joining and worker exit.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts An error event is not treated as thread exit and a failed native receipt cannot become successful close.
   * @evidence contracts/common.md#meaningful-documentation Native prose states admission withdrawal and join order; retained failures become an aggregate terminal error.
   * @evidence contracts/portability.md#os-neutral-implementation AbortController and Worker exit events provide the Node lifetime boundary while platform process cleanup remains native-owned.
   * @evidence contracts/performance.md#efficient-algorithms Shutdown visits admitted controllers, outstanding native operations and created worker exits once; their actual cleanup durations remain delegated.
   * @evidence contracts/performance.md#reuse-equivalent-work Repeated close calls share the same terminal promise without reopening admission.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Queue completion and real native retirement precede worker close, and all created worker exit promises settle before the owner reports terminal success or retained failure.
   */
  public close(): Promise<void> {
    if (this.closing !== undefined) return this.closing;
    this.closed = true;
    for (const controller of this.controllers)
      controller.abort(new DOMException("ttsc: capability resolver closed", "AbortError"));
    this.closing = (async () => {
      await this.queue;
      await Promise.allSettled(this.native);
      const worker = this.worker;
      if (worker !== undefined) {
        worker.ref();
        try { worker.postMessage({ kind: "close" }); }
        catch (error) {
          this.rememberFailure(error);
          // No task remains after queue/native joining, so a failed shutdown
          // message may terminate this idle thread without abandoning leases.
          await worker.terminate();
        }
      }
      await Promise.all(this.exits.values());
      this.worker = undefined;
      if (this.failures.length !== 0)
        throw new AggregateError(this.failures, "ttsc: capability owner failed to retire cleanly");
    })();
    return this.closing;
  }

  private request(body: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> {
    if (this.closed) return Promise.reject(new Error("ttsc: capability resolver is closed"));
    const controller = new AbortController();
    this.controllers.add(controller);
    const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    const operation = this.queue.catch(() => undefined).then(() => this.call(body, controller.signal));
    this.queue = operation.then(() => undefined, () => undefined);
    return operation.finally(() => {
      this.controllers.delete(controller);
      signal?.removeEventListener("abort", abort);
    });
  }

  private async call(body: Record<string, unknown>, signal: AbortSignal): Promise<unknown> {
    signal.throwIfAborted();
    if (this.closed) throw new Error("ttsc: capability resolver is closed");
    if (body.generation !== undefined &&
      (this.worker === undefined || body.generation !== this.generation))
      return body.kind === "current" ? false : undefined;
    const worker = this.worker ?? this.createWorker();
    const generation = this.generation;
    const id = ++this.nextId;
    const cancel = new SharedArrayBuffer(4);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-capability-rpc-"));
    const commands = new Set<Promise<unknown>>();
    const nativeController = new AbortController();
    const stop = () => {
      nativeController.abort(signal.reason);
      Atomics.store(new Int32Array(cancel), 0, 1);
      Atomics.notify(new Int32Array(cancel), 0);
    };
    signal.addEventListener("abort", stop, { once: true });
    if (signal.aborted) stop();
    worker.ref();
    let originalFailure: unknown;
    let failed = false;
    try {
      return await new Promise<unknown>((resolve, reject) => {
        const clear = () => {
          worker.off("message", message);
          worker.off("error", failed);
          worker.off("exit", exited);
        };
        const failed = (error: Error) => {
          nativeController.abort(error);
          clear();
          if (this.worker === worker) this.worker = undefined;
          reject(error);
        };
        const exited = (code: number) => failed(new Error(`ttsc: capability worker exited ${code} before replying`));
        const message = (reply: WorkerReply) => {
          if (reply.id !== id) return;
          if (reply.kind === "command") {
            if (this.closed) {
              const rejection = Promise.resolve().then(() => writeCommandReply(reply, {
                retirement: "not-started",
                thrown: serializeCompilerError(
                  new Error("ttsc: capability resolver is closed"),
                ),
              }));
              commands.add(rejection);
              void rejection.catch((error: unknown) => this.rememberFailure(error));
              return;
            }
            let retirement: "joined" | "not-started" | "unknown" = "not-started";
            const operation = OwnedNativeProcess.run(reply.command, reply.args, reply.options, nativeController.signal,
              (state) => {
                retirement = state;
                if (state === "unknown") this.closed = true;
              })
              .then((result) => writeCommandReply(reply, {
                retirement,
                result: { ...result, ...(result.error === undefined ? {} : { error: serializeCompilerError(result.error) }) },
              }), (error: unknown) => {
                const cancelled = nativeController.signal.aborted && error === nativeController.signal.reason;
                if (!cancelled) this.rememberFailure(error);
                // The worker needs a cancellation classification, while the
                // caller's arbitrary reason stays on its original main thread.
                writeCommandReply(reply, { retirement, thrown: serializeCompilerError(cancelled
                  ? Object.assign(new Error("ttsc: operation cancelled"), { name: "AbortError" })
                  : error) });
              });
            commands.add(operation);
            this.native.add(operation);
            // Keep every command in this request until its final join, including
            // failed exchange writes after native retirement.
            void operation.finally(() => this.native.delete(operation)).catch(() => undefined);
            return;
          }
          clear();
          if (reply.thrown !== undefined) {
            const error = receiveCapabilityFailure(reply, (failure) => this.failures.push(failure));
            if (signal.aborted && error.name === "AbortError") reject(signal.reason);
            else if (signal.aborted) reject(new AggregateError([signal.reason, error], "ttsc: cancellation cleanup failed"));
            else reject(error);
          } else if (signal.aborted) {
            if (body.kind === "resolve") {
              const handle = (reply.value as { handle: number }).handle;
              try { worker.postMessage({ kind: "discard", handle }); }
              catch (error) {
                this.rememberFailure(error);
                reject(new AggregateError([signal.reason, error], "ttsc: cancelled proof retirement failed"));
                return;
              }
            }
            reject(signal.reason);
          }
          else resolve(body.kind === "resolve"
            ? { ...(reply.value as object), generation }
            : reply.value);
        };
        worker.on("message", message);
        worker.once("error", failed);
        worker.once("exit", exited);
        try {
          worker.postMessage({ ...body, id, cancel, directory, env: { ...process.env } });
        } catch (error) {
          failed(error instanceof Error ? error : new Error(String(error)));
        }
      });
    } catch (error) {
      failed = true;
      originalFailure = error;
      throw error;
    } finally {
      signal.removeEventListener("abort", stop);
      await Promise.allSettled(commands);
      if (this.worker !== worker) await this.exits.get(worker);
      worker.unref();
      try { fs.rmSync(directory, { force: true, recursive: true }); }
      catch (error) {
        this.rememberFailure(error);
        throw failed ? new AggregateError([originalFailure, error], "ttsc: resolver request cleanup failed") : error;
      }
    }
  }

  /** Keep idle worker failures observed and prevent reuse of a retired thread. */
  private createWorker(): Worker {
    const worker = new Worker(path.join(__dirname, "internal", "capabilityPluginWorker.js"));
    const retire = () => {
      if (this.worker === worker) this.worker = undefined;
    };
    worker.on("error", (error: unknown) => {
      this.failWorker(error instanceof Error ? error : new Error(String(error)));
      retire();
    });
    const exited = new Promise<void>((resolve) => worker.once("exit", (code) => {
      if (code !== 0 || this.closing === undefined)
        this.failWorker(new Error(`ttsc: capability worker exited ${code}${this.closing === undefined ? " unexpectedly" : ""}`));
      retire();
      resolve();
    }));
    this.exits.set(worker, exited);
    worker.unref();
    ++this.generation;
    this.worker = worker;
    return worker;
  }

  /** Retain failed ownership outcomes while treating requested abort as normal. */
  private rememberFailure(error: unknown): void {
    if (!(error instanceof Error) || error.name !== "AbortError")
      this.failures.push(error);
  }

  /** Refuse new work after a thread fails with potentially unknown lease state. */
  private failWorker(error: Error): void {
    this.rememberFailure(error);
    this.closed = true;
    for (const controller of this.controllers) controller.abort(error);
  }
}

/**
 * Public data and lifetime contract of an asynchronously owned lookup.
 *
 * This namespace augments the class's single semantic owner with the result
 * type. The class acknowledges that owner; Resolution describes its data and
 * callback contract separately.
 */
export namespace CapabilityPluginResolver {
  /**
   * The original lookup's data and asynchronous proof lifetime.
   *
   * @evidence contracts/common.md#principled-implementation The proof callbacks refer to this exact lookup and its worker generation rather than a reconstructed cache witness.
   * @evidence contracts/common.md#clear-and-simple-design Status and plugin data are separate from asynchronous currentness and terminal release.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The type promises an opaque query, not an inferred freshness flag or bypass of resolver authority.
   * @evidence contracts/common.md#meaningful-documentation Member prose identifies answer data, optional cancellation and explicit proof retirement.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This data and callback type chooses no filesystem or process primitive.
   * @evidenceExclude contracts/performance.md#efficient-algorithms The interface chooses no execution strategy; resolve and its request owner implement the operations.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The interface defines proof identity but performs no result sharing.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Actual proof retention and release belong to the resolver callbacks, not this declaration.
   */
  export interface Resolution {
    /** Original resolver availability classification. */
    readonly status: "resolved" | "unavailable";
    /** Published capability metadata from this lookup. */
    readonly plugins: readonly ITtscCapabilityPlugin[];
    /**
     * Query the retained proof, optionally withdrawing payload admission.
     *
     * @evidence contracts/common.md#principled-implementation This callback refers to the original lookup and worker generation, so only its original authority can establish currentness.
     * @evidence contracts/common.md#clear-and-simple-design An optional signal controls one asynchronous proof query and the boolean conveys only its acceptance.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts The contract does not allow rebuilding a partial inventory or treating an unavailable answer as a reusable result.
     * @evidence contracts/common.md#meaningful-documentation Native prose explains retained proof identity and cancellation without claiming that the type performs the query.
     * @evidenceExclude contracts/portability.md#os-neutral-implementation This callable field declares a query; the resolver implements its actual native boundary.
     * @evidenceExclude contracts/performance.md#efficient-algorithms A function type declares no algorithm; resolve and request own execution costs.
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work The type establishes proof identity but itself shares no computation.
     * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The field declares no acquired resource; its owning resolver retains and releases the proof.
     */
    readonly isCurrent: (options?: { signal?: AbortSignal }) => Promise<boolean>;
    /**
     * Retire this proof without affecting a later worker generation.
     *
     * @evidence contracts/common.md#principled-implementation Release is bound to this answer's generation-qualified handle and cannot retire a later answer with a repeated numeric handle.
     * @evidence contracts/common.md#clear-and-simple-design One asynchronous terminal callback withdraws this answer's reusable proof.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts The callback describes real proof retirement rather than changing its currentness flag while retaining its closure indefinitely.
     * @evidence contracts/common.md#meaningful-documentation Native prose identifies which proof is retired and excludes later generations.
     * @evidenceExclude contracts/portability.md#os-neutral-implementation This callable type selects no platform primitive; the owner implements its worker communication.
     * @evidenceExclude contracts/performance.md#efficient-algorithms The field declares a callback and performs no processing.
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work Release is terminal proof ownership, not a computation-sharing operation.
     * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The declaration itself acquires no resource; resolve's closure and close implement actual retirement.
     */
    readonly release: () => Promise<void>;
  }
}

interface WorkerReply {
  id: number;
  kind: "reply" | "command";
  value?: unknown;
  thrown?: unknown;
  ownershipFailed?: boolean;
  command: string;
  args: string[];
  options: SpawnSyncOptions;
  done: SharedArrayBuffer;
  responseFile: string;
}

function writeCommandReply(reply: WorkerReply, value: unknown): void {
  try {
    fs.writeFileSync(reply.responseFile, serialize(value));
  } finally {
    Atomics.store(new Int32Array(reply.done), 0, 1);
    Atomics.notify(new Int32Array(reply.done), 0);
  }
}
