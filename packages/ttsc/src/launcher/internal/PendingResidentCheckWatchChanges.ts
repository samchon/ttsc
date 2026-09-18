import { type ResidentCheckWatchChange } from "../../compiler/internal/build/ResidentCheckWatchChange";
import { type WatchInputChange } from "./watch/WatchInputChange";

/**
 * Coalesces filesystem events until the next resident check-watch cycle.
 *
 * A full reload dominates every narrower signal. Program invalidation remains
 * distinct so a project-input module creation/deletion can cold-load the
 * Program without discarding the selected execution or restarting the sidecar.
 */
export class PendingResidentCheckWatchChanges {
  private readonly changed = new Set<string>();
  private readonly external = new Set<string>();
  private invalidate = false;
  private reload = false;

  /**
   * Fold one filesystem event into the pending cycle.
   *
   * A config or plugin change, a compiler-topology change without a path, or
   * an explicit `reload` escalates to a full reload and discards narrower
   * signals. Otherwise the path is recorded as changed, and additionally as
   * external when it is a declared project-rule input.
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
