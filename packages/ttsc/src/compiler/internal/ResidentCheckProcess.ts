import path from "node:path";
import { Worker } from "node:worker_threads";

import { workerModuleUrl } from "../../internal/workerModuleUrl";
import type { ResidentCheckProcessOptions } from "./ResidentCheckProcessOptions";
import type { ResidentCheckProcessProtocol } from "./ResidentCheckProcessProtocol";
import type { ResidentCheckRequest } from "./ResidentCheckRequest";
import type { ResidentCheckResult } from "./ResidentCheckResult";

/**
 * FIFO check client whose worker owns the child and its complete pipe lifetime.
 *
 * Watch topology can block the launcher's loop after shutdown timers start. Keeping spawn, EOF, signals, output draining and close on one independent loop prevents that work from spending a live child's shutdown grace or overtaking its pending close. An exit code alone never proves pipe closure: a living descendant can retain inherited stdout or stderr (#1758).
 *
 * The caller owns disposal. Retirement uses the host's one-second input flush, EOF grace and forced-join policies. Only its actual-close receipt authorizes replacement; worker failure leaves joining unknown and rejected. Strict close additionally requires a graceful zero exit. Neither worker nor client claims termination of unrelated descendants. Abrupt process exit can still interrupt cleanup.
 *
 * One worker serves one child across requests. Messages copy serialized request and reply bytes; pending request count and reply size have no fixed cap. Retirement rejects pending callers immediately and joins its worker after the terminal receipt. The client retains the Worker object.
 *
 * @evidence contracts/common.md#principled-implementation The independent loop owns every observation needed for retirement, and only its actual child-close receipt permits replacement, keeping parent event-loop blocking outside shutdown timing.
 * @evidence contracts/common.md#clear-and-simple-design The client owns caller serialization and settlement; its worker owns the native transport and shutdown state machine.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No elapsed parent deadline, worker exit, signal attempt or exit code fabricates a joined child; unknown worker failure rejects joining.
 * @evidence contracts/common.md#meaningful-documentation Native prose documents the blocking hazard, inherited-pipe authority, disposal, failure effects and unbounded request population.
 * @evidence contracts/portability.md#os-neutral-implementation Node loads a sibling worker using the current source or emitted extension and inherited loader arguments; the host uses native executable argv and pipes without shell commands.
 * @evidence contracts/performance.md#efficient-algorithms Serialization and structured cloning visit message bytes; a request-id map gives constant-time settlement without scanning earlier requests. Worker startup and one thread per active child are additional costs; no speedup is claimed.
 * @evidence contracts/performance.md#reuse-equivalent-work One worker and child serve the startup-selected check process across FIFO requests; each request remains effectful and receives its own result.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The client owns one worker and one resolver pair per pending request. Results or retirement remove resolvers; joining waits for the terminal receipt and worker exit. Unexpected worker failure rejects callers and joining and removes worker liveness. Request count and bytes are uncapped, and the client object retains its Worker reference.
 */
export class ResidentCheckProcess {
  private readonly worker: Worker;
  private readonly pending = new Map<
    number,
    {
      resolve(result: ResidentCheckResult): void;
      reject(error: Error): void;
    }
  >();
  private ordinal = 0;
  private failure: Error | undefined;
  private closeError: Error | undefined;
  private joinError: Error | undefined;
  private terminal = false;
  private readonly exited: Promise<void>;
  private resolveExit!: () => void;
  private rejectExit!: (error: Error) => void;

  public constructor(options: ResidentCheckProcessOptions) {
    this.exited = new Promise<void>((resolve, reject) => {
      this.resolveExit = resolve;
      this.rejectExit = reject;
    });
    void this.exited.catch(() => {});
    this.worker = new Worker(
      workerModuleUrl(
        path.join(
          __dirname,
          `ResidentCheckProcessHost${path.extname(__filename)}`,
        ),
      ),
      {
        workerData: {
          ...options,
          args: [...options.args],
          env: { ...options.env },
        },
      },
    );
    this.worker.on("message", (reply: ResidentCheckProcessProtocol.Reply) => {
      if (this.terminal) return;
      if (reply.kind === "terminal") {
        this.terminal = true;
        this.joinError = reply.joinError;
        this.closeError = reply.closeError;
        this.fail(
          reply.joinError ??
            reply.closeError ??
            new Error("ttsc: resident check host exited"),
        );
      } else {
        const pending = this.pending.get(reply.id);
        if (pending === undefined) return;
        this.pending.delete(reply.id);
        if (reply.kind === "result") pending.resolve(reply.result);
        else {
          pending.reject(reply.error);
          this.fail(reply.error);
        }
      }
    });
    this.worker.on("error", (error) => this.workerFailed(asError(error)));
    this.worker.once("exit", (code) => {
      if (!this.terminal)
        this.workerFailed(
          new Error(
            `ttsc: resident check process owner exited before child retirement (code ${code})`,
          ),
        );
      else if (this.joinError === undefined) this.resolveExit();
      else this.rejectExit(this.joinError);
    });
  }

  /**
   * Serialize one cycle before admission and pair its reply with this caller. Serialization failure rejects only this call when its thrown value can be normalized to an Error; normalization itself can throw synchronously. A retired transport rejects all admitted calls and every later request.
   *
   * @evidence contracts/common.md#principled-implementation Serialization precedes worker admission; identifiers pair results with their admitted callers while the host preserves FIFO check execution.
   * @evidence contracts/common.md#clear-and-simple-design Caller serialization stays in the client, and the host alone validates native replies and retires a failed transport.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A failed conversion adds no request slot; worker failure rejects rather than fabricating a check result.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes serialization rejection and synchronous normalization failure from terminal transport failure.
   * @evidence contracts/portability.md#os-neutral-implementation Native input paths remain JSON data across the message and pipe boundaries without shell interpolation.
   * @evidence contracts/performance.md#efficient-algorithms JSON conversion and message copying visit input bytes, caller-defined conversion can add arbitrary work, and map admission and settlement use constant-time key operations.
   * @evidence contracts/performance.md#reuse-equivalent-work Each effectful cycle owns a request and reply even when its payload matches an earlier cycle.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Each admitted call retains resolver callbacks until its result or shared retirement; request population and serialized bytes have no fixed cap.
   */
  public request(payload: ResidentCheckRequest): Promise<ResidentCheckResult> {
    if (this.failure !== undefined) return Promise.reject(this.failure);
    let line: string;
    try {
      line = `${JSON.stringify(payload)}\n`;
    } catch (error) {
      return Promise.reject(asError(error));
    }
    return new Promise<ResidentCheckResult>((resolve, reject) => {
      const id = ++this.ordinal;
      this.pending.set(id, { resolve, reject });
      try {
        this.worker.postMessage({
          kind: "request",
          id,
          line,
        } satisfies ResidentCheckProcessProtocol.Command);
      } catch (error) {
        this.workerFailed(asError(error));
      }
    });
  }

  /**
   * Retire once and reject pending callers without waiting for native close.
   *
   * @evidence contracts/common.md#principled-implementation Terminal caller failure is set before rejection, and one retire command delegates EOF and joining to the owner.
   * @evidence contracts/common.md#clear-and-simple-design Disposal initiates the host's existing retirement state machine rather than maintaining parent-side timers.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Repeated disposal cannot revive a request or authorize replacement before actual joining.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies immediate rejection and asynchronous native retirement.
   * @evidence contracts/portability.md#os-neutral-implementation A Node message delegates native EOF and signaling without platform-specific PID commands.
   * @evidence contracts/performance.md#efficient-algorithms Rejection visits the outstanding request map once and posts one constant-size retirement command.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Disposal invalidates an owner without creating a reusable computation.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Pending callbacks are released immediately; the referenced worker keeps cleanup alive until its terminal receipt and exit, and unknown ownership remains failure.
   */
  public dispose(): void {
    if (this.failure !== undefined) return;
    this.fail(new Error("ttsc: resident check host disposed"));
    try {
      this.worker.postMessage({
        kind: "retire",
      } satisfies ResidentCheckProcessProtocol.Command);
    } catch (error) {
      this.workerFailed(asError(error));
    }
  }

  /**
   * Await actual child close and the owner thread, requiring graceful zero exit. Repeated calls share retirement but retain strict shutdown failure.
   *
   * @evidence contracts/common.md#principled-implementation Success requires the host's actual-close receipt, strict status validation and owner-thread exit.
   * @evidence contracts/common.md#clear-and-simple-design Strict shutdown adds status validation to the same joining promise used by recovery.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Neither worker disappearance nor requested forced termination substitutes for graceful child close.
   * @evidence contracts/common.md#meaningful-documentation Native prose states child and thread joining, strict zero exit and repeated failure behavior.
   * @evidence contracts/portability.md#os-neutral-implementation Node worker messages carry the native host's observed close outcome without interpreting a PID or shell status.
   * @evidence contracts/performance.md#efficient-algorithms Closing reuses retirement and performs constant-time outcome validation after its one pending-request traversal.
   * @evidence contracts/performance.md#reuse-equivalent-work Repeated closes await this owner's single terminal promise while retaining strict status independently from recovery joining.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The host releases its pipes and timers on actual close or failed joining; the client awaits worker exit, releases pending callbacks, and preserves unknown ownership as rejection.
   */
  public async close(): Promise<void> {
    this.dispose();
    await this.exited;
    if (this.closeError !== undefined) throw this.closeError;
  }

  /**
   * Join a known failed child and its owner before replacement. Waiting alone starts no retirement deadline; unknown ownership rejects.
   *
   * @evidence contracts/common.md#principled-implementation A known failed child can be replaced only after its actual-close receipt and worker exit.
   * @evidence contracts/common.md#clear-and-simple-design Recovery consumes joining separately from strict shutdown status.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown worker or pipe ownership remains rejection rather than successful retirement.
   * @evidence contracts/common.md#meaningful-documentation Native prose states replacement authority, passive waiting and unknown failure.
   * @evidence contracts/portability.md#os-neutral-implementation The owner observes native close through Node APIs instead of treating signals or process IDs as portable joining proof.
   * @evidence contracts/performance.md#efficient-algorithms The accessor returns an existing promise without timers, native probes or additional listeners.
   * @evidence contracts/performance.md#reuse-equivalent-work All waiters share the same owner's terminal promise; replacement owns a new worker and promise.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Passive waiting can remain pending for a live unretired host; active retirement releases owned resources through its existing deadlines and terminal worker exit.
   */
  public waitForExit(): Promise<void> {
    return this.exited;
  }

  private fail(error: Error): void {
    this.failure ??= error;
    for (const pending of this.pending.values()) pending.reject(this.failure);
    this.pending.clear();
  }

  private workerFailed(error: Error): void {
    if (this.terminal) return;
    this.terminal = true;
    this.joinError = error;
    this.fail(error);
    this.rejectExit(error);
    this.worker.unref();
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
