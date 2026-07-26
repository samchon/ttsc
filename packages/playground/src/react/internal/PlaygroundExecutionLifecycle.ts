export interface IPlaygroundExecutionAttempt {
  /** Signal passed through every cancellable step owned by this attempt. */
  readonly signal: AbortSignal;
  /** Whether this attempt may still commit messages or state. */
  isCurrent(): boolean;
  /** Release the active slot if this is still the current attempt. */
  finish(): boolean;
}

/**
 * Owns the cancellation and stale-write boundary for Execute attempts.
 *
 * React state stays in `PlaygroundShell`; this small state machine keeps the
 * supersession rules independently testable and makes every invalidation path
 * use the same abort behavior.
 */
export class PlaygroundExecutionLifecycle {
  private active: AbortController | null = null;
  private epoch = 0;

  public begin(): IPlaygroundExecutionAttempt {
    this.invalidate("a newer Execute started");
    const controller = new AbortController();
    const epoch = this.epoch;
    this.active = controller;
    return {
      signal: controller.signal,
      isCurrent: () => this.epoch === epoch && this.active === controller,
      finish: () => {
        if (this.epoch !== epoch || this.active !== controller) return false;
        this.active = null;
        return true;
      },
    };
  }

  /**
   * Abort the active attempt and make its callbacks stale.
   *
   * Returns whether an active attempt was canceled.
   */
  public invalidate(reason: string): boolean {
    const active = this.active;
    this.active = null;
    ++this.epoch;
    active?.abort(createExecutionAbortError(reason));
    return active !== null;
  }
}

function createExecutionAbortError(reason: string): Error {
  const error = new Error(`Playground execution aborted: ${reason}.`);
  error.name = "AbortError";
  return error;
}
