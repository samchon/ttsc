import type { ResidentReplyKind } from "./ResidentReplyKind";
import { ResidentTransformReply } from "./ResidentTransformReply";

/**
 * FIFO promise slots and terminal rejection for one resident reply stream.
 * The transport owns framing, writing, error construction and child shutdown;
 * this state owner releases settled callbacks and abort listeners.
 *
 * @evidence contracts/common.md#principled-implementation Each admitted slot settles once, head advancement preserves FIFO reply ownership, and retirement becomes terminal before all remaining slots are rejected.
 * @evidence contracts/common.md#clear-and-simple-design One state owner holds slots, cursor and terminal error; native transport actions remain with ResidentTransformProcess.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual promise callbacks and AbortSignals are retained without constructing a peer, replacing streams or inventing host replies.
 * @evidence contracts/common.md#meaningful-documentation Native prose bounds this state operation separately from framing, cancellation error policy and native shutdown.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This owner uses JavaScript arrays, callbacks and standard AbortSignal listeners without filesystem or native process operations.
 * @evidence contracts/performance.md#efficient-algorithms Cursor settlement is amortized constant queue work; consumed prefixes compact only after at least half is consumed, while retirement drains the retained slot array linearly. Callback work remains supplied and is not bounded here.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Slots represent distinct live requests, not equivalent computations or a reusable reply cache.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Settlement releases its queue reference and abort listener; retirement detaches the queue and rejects live slots. Live pending population has no cap or deadline, and native child lifetime remains outside this owner.
 */
export class ResidentTransformRequests {
  /** First terminal error, preserved for later request rejection. */
  public failure: Error | undefined;

  private readonly pending: (PendingRequest | undefined)[] = [];
  private pendingHead = 0;

  /**
   * Current FIFO slot, or no queued reply owner. This read does not consume it.
   *
   * @evidence contracts/common.md#principled-implementation The current cursor identifies the single slot that may own the next reply without advancing or inventing an owner.
   * @evidence contracts/common.md#clear-and-simple-design A read-only cursor lookup separates reply ownership from settlement.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Only an admitted array slot is returned; no synthetic request or reply is constructed.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes observing the slot from consuming it.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation In-memory array indexing has no native platform boundary.
   * @evidence contracts/performance.md#efficient-algorithms One cursor-indexed array read does not scan the pending population.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This is a state lookup, not reusable computation coordination.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned slot remains owned by the queue and caller; this read creates no historical state or handle.
   */
  public current(): PendingRequest | undefined {
    return this.pending[this.pendingHead];
  }

  /**
   * Admit one already framed line to its FIFO owner. Malformed or unsolicited
   * replies retire the stream; an invalid operation shape rejects only its
   * own slot. Return whether native transport teardown is now required.
   *
   * @evidence contracts/common.md#principled-implementation Terminal tails and blank lines are ignored, malformed JSON retires all live slots to prevent shifted ownership, and valid JSON with the wrong operation shape consumes only the current slot.
   * @evidence contracts/common.md#clear-and-simple-design Existing reply parsing and admission feed the same settlement and retirement owner without taking over native line framing.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual framed text and slot kind drive outcomes; no peer, compiler reply or native-close receipt is invented.
   * @evidence contracts/common.md#meaningful-documentation Native prose separates stream corruption from operation-shape failure and transport teardown.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation String and JSON admission performs no native stream or process operation.
   * @evidence contracts/performance.md#efficient-algorithms Trimming and JSON parsing cost line bytes; error echo is capped at 200 code units, settlement is amortized queue work and terminal retirement visits outstanding slots.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each line belongs to one request; no reply result is memoized or reused.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Settlement and retirement release slots/listeners; supplied framed lines have no length bound here, while retained error echoes are capped. Native pipes and child release remain with the transport.
   */
  public accept(line: string): boolean {
    if (this.failure !== undefined) return false;
    const trimmed = line.trim();
    if (trimmed.length === 0) return false;
    const request = this.current();
    if (request === undefined) {
      return this.retire(
        new Error("ttsc: resident transform host sent an unsolicited reply"),
      );
    }
    const reply = ResidentTransformReply.parse(trimmed);
    if (reply === undefined) {
      const error = new Error(
        `ttsc: resident transform host sent a malformed reply: ${echoLine(trimmed)}`,
      );
      this.settle(request, error);
      return this.retire(error);
    }
    if (!ResidentTransformReply.isValid(reply, request.kind)) {
      this.settle(
        request,
        new Error(
          `ttsc: resident transform host sent an invalid ${request.kind} reply: ${echoLine(trimmed)}`,
        ),
      );
      return false;
    }
    this.settle(request, reply);
    return false;
  }

  /**
   * Register one slot and its optional abort listener before enqueueing it.
   * The transport performs its original post-enqueue aborted check and write.
   *
   * @evidence contracts/common.md#principled-implementation Resolver identity and expected reply kind stay with one slot; the standard signal listener invokes the owning transport's cancellation operation.
   * @evidence contracts/common.md#clear-and-simple-design Admission creates the slot, installs its listener and appends it in that order, while write and cancellation policy remain with the transport.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The supplied callback is the production cancellation owner, with no fake stream, peer or host output.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies listener order and the remaining post-enqueue/write responsibility.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Array admission and standard AbortSignal registration perform no native platform operation.
   * @evidence contracts/performance.md#efficient-algorithms Admission appends one slot and registers at most one listener; callback execution costs belong to the supplied cancellation operation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Every slot represents a distinct request and no computation reuse is selected.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Each live slot retains resolver callbacks and at most one abort listener until settlement or retirement; pending population is uncapped.
   */
  public add(
    kind: ResidentReplyKind,
    resolve: (reply: Record<string, unknown>) => void,
    reject: (reason: Error) => void,
    signal: AbortSignal | undefined,
    onAbort: (pending: PendingRequest) => void,
  ): PendingRequest {
    const pending: PendingRequest = {
      kind,
      reject,
      resolve,
      settled: false,
      signal,
    };
    if (signal !== undefined) {
      pending.abort = () => onAbort(pending);
      signal.addEventListener("abort", pending.abort, { once: true });
    }
    this.pending.push(pending);
    return pending;
  }

  /**
   * Settle a slot once, releasing its listener and any matching FIFO head.
   * Detached slots from retirement still settle but cannot shift a newer head.
   *
   * @evidence contracts/common.md#principled-implementation The settled guard prevents duplicate callbacks; head identity controls cursor advancement and Error results reject while object replies resolve.
   * @evidence contracts/common.md#clear-and-simple-design One settlement operation handles normal replies, write errors, cancellation and detached retirement slots.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Settlement uses the actual supplied result and slot identity without inferring host status or replacing promise callbacks.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes head release, detached slots and exactly-once settlement.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Standard signal listener removal and in-memory promise callbacks need no native platform branch.
   * @evidence contracts/performance.md#efficient-algorithms Head movement is constant until half-consumed compaction copies the remaining array, giving amortized constant queue work; supplied callback work is additional.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Exactly-once slot settlement is request ownership, not reusable computation selection.
   * @evidence contracts/performance.md#bound-retention-and-release-resources A settled head clears its array reference, and settlement removes its abort listener before callbacks. A non-head slot can remain referenced until head progression or retirement, with no history retained after detachment.
   */
  public settle(
    pending: PendingRequest,
    result: Error | Record<string, unknown>,
  ): void {
    if (pending.settled) return;
    pending.settled = true;
    if (this.pending[this.pendingHead] === pending) {
      this.pending[this.pendingHead++] = undefined;
      if (this.pendingHead * 2 >= this.pending.length) {
        this.pending.splice(0, this.pendingHead);
        this.pendingHead = 0;
      }
    }
    if (pending.signal !== undefined && pending.abort !== undefined) {
      pending.signal.removeEventListener("abort", pending.abort);
    }
    if (result instanceof Error) pending.reject(result);
    else pending.resolve(result);
  }

  /**
   * Preserve the first failure and reject all remaining slots before the
   * transport tears down its reader and child. Return whether this call retired.
   *
   * @evidence contracts/common.md#principled-implementation Terminal error assignment precedes queue detachment and rejection, so reentrant callers observe failure and later retirement cannot replace the original error.
   * @evidence contracts/common.md#clear-and-simple-design State retirement returns a transition indicator; the actual transport alone owns reader, pipe and child termination.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No child exit or stream-close outcome is fabricated from terminal queue state.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies ordering, first-error identity and the caller's remaining native teardown.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Queue detachment and callback settlement are in-memory operations, independent of native signaling.
   * @evidence contracts/performance.md#efficient-algorithms One array detachment and one visit per retained slot drain the queue; rejection callback work remains additional.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The terminal guard makes a state transition idempotent rather than reusing a computation result.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Detached slots settle and remove listeners; only the terminal Error remains with this owner. Child handles and termination timers remain with the actual transport.
   */
  public retire(error: Error): boolean {
    if (this.failure !== undefined) return false;
    this.failure = error;
    const pending = this.pending.splice(0);
    this.pendingHead = 0;
    for (const request of pending) {
      if (request !== undefined) this.settle(request, error);
    }
    return true;
  }
}

/** Actual resolver callbacks and optional abort listener for one FIFO slot. */
interface PendingRequest {
  abort?: () => void;
  kind: ResidentReplyKind;
  reject: (reason: Error) => void;
  resolve: (reply: Record<string, unknown>) => void;
  settled: boolean;
  signal?: AbortSignal;
}

/** Cap on how much of an offending line an error message echoes back. */
const REPLY_ECHO_LIMIT = 200;

/** Truncate an offending reply line so error messages stay bounded. */
function echoLine(line: string): string {
  return line.length > REPLY_ECHO_LIMIT
    ? `${line.slice(0, REPLY_ECHO_LIMIT)}…`
    : line;
}
