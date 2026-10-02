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
 * @evidence contracts/performance.md#efficient-algorithms At most two Set insertions retain each event path, including string hashing/equality work. Draining sorts each distinct population with string comparisons and allocates returned references; retained path bytes grow with unique spellings until take or escalation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This accumulator merges delivery data, not completed or in-flight producer work; the caller owns scheduling checks and the session owns process reuse.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The pending cycle owns distinct path strings and releases them on take or escalation; population is bounded by distinct events between cycles, without a separate numeric cap if the caller stops draining.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Coalesces event paths held as opaque strings; it resolves no path and touches no filesystem.
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
   * @evidence contracts/performance.md#efficient-algorithms Normal events use at most two Set insertions, including path-string hashing and equality; escalation releases both populations rather than rebuilding an event history.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Folding duplicate delivery paths establishes no shared computation result; actual check scheduling and resident reuse belong to consumers.
   * @evidence contracts/performance.md#bound-retention-and-release-resources This accumulator retains unique paths until take or full reload; no bound independent of the caller's drain rate is imposed.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Records event paths as opaque strings in sets and compares only event kinds; it resolves no path and touches no filesystem.
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
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Absent fields remain omitted in this watch batch instead of using consumer-specific sentinels; the wire adapter separately selects protocol fields and handles coordinator-only reload.
   * @evidence contracts/common.md#meaningful-documentation The method documents deterministic path order and destructive drain semantics needed by callers.
   * @evidence contracts/performance.md#efficient-algorithms Each distinct path population is copied and sorted once, including path-string comparison costs; returned arrays scale with unique references and reset releases the accumulator's ownership.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Draining transfers delivery ownership and resets state; reusing an earlier batch would replay effects rather than share equivalent producer work.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Ownership of arrays transfers to the caller while the accumulator clears its sets and flags; retaining returned batches is the consumer's responsibility.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Draining reads and clears this instance's flags and opaque path sets without resolving filesystem identity or calling a native process API.
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
