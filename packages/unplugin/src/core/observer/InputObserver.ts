import type { TtscWatchInput } from "../transform/watch/TtscWatchInput";

/**
 * The adapter's own observer of compiler inputs, keyed by owner
 * (`createInputObserver`).
 */
export interface InputObserver {
  /**
   * The current change sequence, taken before a compile so a registration can
   * tell what changed during it.
   */
  begin(): number;
  /**
   * Close every scope, poller, and timer, and forget every owner. The observer
   * stays open on its root, and observes owners again as they register.
   */
  dispose(): Promise<void>;
  /** Release every input one owner registered. */
  forget(owner: string): void;
  /**
   * Anchor the observer at a root, which a pinned scope then observes, unless
   * the host declared polling, which sends every input to the bounded poll
   * instead (samchon/ttsc#1395). Called again, it re-anchors. Nothing is
   * observed before the first call.
   */
  open(root: string, polling: boolean): void;
  /**
   * Replace one owner's inputs with a delivery's, keeping a failed delivery's
   * previous spellings for recovery. Each input is proven against the disk now,
   * or, given `startedAt`, only against changes since that sequence
   * (samchon/ttsc#1423).
   */
  replace(
    owner: string,
    inputs: readonly TtscWatchInput[],
    failed?: boolean,
    startedAt?: number,
  ): void;
}
