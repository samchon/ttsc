import { type ResidentCheckWatchChange } from "../../compiler/internal/build/ResidentCheckWatchChange";
import { type WatchInputChange } from "./watch/WatchInputChange";

/**
 * Coalesces filesystem events until the next resident check-watch cycle.
 *
 * A full reload dominates every narrower signal. Program invalidation remains
 * distinct so a project-input module creation/deletion can cold-load the
 * Program without discarding the selected execution or restarting the sidecar.
 *
 * @evidence contracts/common.md#principled-implementation Two path sets preserve changed versus declared external inputs, while reload dominates and clears narrower state; program invalidation remains a separate supported signal.
 * @evidence contracts/common.md#clear-and-simple-design push folds event precedence and take transfers one deterministic batch then resets; callers own the scheduling and native path identity supplied here.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The reload/compiler/config distinctions come from watcher protocol semantics rather than an event-count threshold or fixture-specific path.
 * @evidence contracts/common.md#meaningful-documentation Native class and method paragraphs explain signal dominance, external membership and reset ownership; members receive no checklist tags.
 * @evidence contracts/performance.md#efficient-algorithms Set insertion deduplicates expected O(1) events; take sorts U distinct changed/external paths in O(U log U) and allocates O(U) batch storage.
 * @evidence contracts/performance.md#reuse-equivalent-work Repeated identical path notifications share one pending set entry until the next take; reload removes narrower events because its cold reload subsumes them.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The pending cycle owns distinct path strings and releases them on take or escalation; population is bounded by distinct events between cycles, without a separate numeric cap if the caller stops draining.
 */
export class PendingResidentCheckWatchChanges {
  private readonly changed = new Set<string>();
  private readonly external = new Set<string>();
  private invalidate = false;
  private reload = false;

  /**
   * Fold one filesystem event into the pending cycle.
   *
   * A config or plugin change, a compiler-topology change without a path, or an
   * explicit `reload` escalates to a full reload and discards narrower signals.
   * Otherwise the path is recorded as changed, and additionally as external
   * when it is a declared project-rule input.
   *
   * @evidence contracts/common.md#principled-implementation Reload precedence is checked before incremental folding, and project events are included in both changed and external sets as required by resident checks.
   * @evidence contracts/common.md#clear-and-simple-design One method updates the three signal forms and path sets, preserving the take boundary as the sole batch transfer.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Compiler events without a path conservatively select the supported full-reload operation instead of inventing a path or retrying a failed assumption.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs identify escalation triggers and distinguish changed from external inputs, with prose separated from tags.
   * @evidence contracts/performance.md#efficient-algorithms Normal events use at most two set insertions; escalation clears retained paths rather than scanning and rewriting an event list.
   * @evidence contracts/performance.md#reuse-equivalent-work Sets share repeated path events within this cycle, and an already-selected reload discards redundant narrower notifications.
   * @evidence contracts/performance.md#bound-retention-and-release-resources This accumulator retains unique paths until take or full reload; no bound independent of the caller's drain rate is imposed.
   */
  public push(change?: WatchInputChange, reload = false): void {
    if (reload || change?.kind === "config" || change?.kind === "plugin") {
      this.reload = true;
      this.invalidate = false;
      this.changed.clear();
      this.external.clear();
      return;
    }
    if (this.reload) return;
    if (change?.invalidate === true) this.invalidate = true;
    if (change?.path === undefined) {
      if (change?.kind === "compiler") {
        this.reload = true;
        this.invalidate = false;
        this.changed.clear();
        this.external.clear();
      }
      return;
    }
    this.changed.add(change.path);
    if (change.kind === "project") this.external.add(change.path);
  }

  /**
   * Return everything accumulated since the last call, with paths sorted, and
   * reset to empty.
   *
   * @evidence contracts/common.md#principled-implementation Optional fields encode only present signals, sorted arrays transfer set contents, and resetting every flag/set makes the next batch independent.
   * @evidence contracts/common.md#clear-and-simple-design Batch construction and complete state reset stay in the same synchronous operation, without exposing mutable sets to consumers.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Empty fields are omitted by the resident protocol rather than substituted with consumer-specific sentinels.
   * @evidence contracts/common.md#meaningful-documentation The method documents deterministic path order and destructive drain semantics needed by callers.
   * @evidence contracts/performance.md#efficient-algorithms Sorting each distinct path population costs O(U log U), with O(U) returned array storage and no repeated sorting before the drain.
   * @evidence contracts/performance.md#reuse-equivalent-work Each cycle emits already-deduplicated events once; returning a prior batch again would replay effects, so batches are not cached across take calls.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Ownership of arrays transfers to the caller while the accumulator clears its sets and flags; retaining returned batches is the consumer's responsibility.
   */
  public take(): ResidentCheckWatchChange {
    const change: ResidentCheckWatchChange = {
      ...(this.reload ? { reload: true } : {}),
      ...(this.invalidate ? { invalidate: true } : {}),
      ...(this.changed.size === 0 ? {} : { changed: [...this.changed].sort() }),
      ...(this.external.size === 0
        ? {}
        : { external: [...this.external].sort() }),
    };
    this.reload = false;
    this.invalidate = false;
    this.changed.clear();
    this.external.clear();
    return change;
  }
}
