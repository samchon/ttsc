import assert from "node:assert/strict";

import { waitFor } from "./internal/waitFor";

/**
 * Observe the original watch session's build markers and finite idle windows.
 *
 * The process owner forwards both output streams, actual errors and actual
 * close. Elapsed age never proves a missing build. The containing native E2E
 * owner supplies operator cancellation and joins the process tree separately.
 *
 * @evidence contracts/common.md#principled-implementation Complete and failed markers both retire a started cycle; starts remain separate. Actual error or close rejects unmet observations, while a finite quiet window asserts only absence during that interval.
 * @evidence contracts/common.md#clear-and-simple-design One concrete transcript owner serves the real WatchSession and direct units. The existing waitFor owns positive polling; listeners own finite quiet assertions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Original stream chunks and terminal callbacks supply every result, without synthetic markers, elapsed progress failures or replaced process methods.
 * @evidence contracts/common.md#meaningful-documentation Explains stream and terminal handoff, finite quiet meaning and the separate native cancellation/join owner; public members describe their observations.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This class observes strings and callbacks; WatchSession owns native process arguments and stream connections.
 * @evidence contracts/performance.md#efficient-algorithms Each chunk rescans both accumulated output streams, with time proportional to their bytes and active quiet observers. Incremental transcript parsing is not claimed.
 * @evidence contracts/performance.md#reuse-equivalent-work All observations share one original session transcript and current counters; unrelated sessions have independent instances.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Positive observations release waitFor timers on completion or terminal failure. Quiet observers clear their timer and listener on every outcome. Transcript bytes remain unbounded for the session lifetime, and native process retirement remains the containing owner's responsibility.
 */
export class WatchBuildObservation {
  private output = "";
  private readonly streams = { stdout: "", stderr: "" };
  private builds = 0;
  private starts = 0;
  private closed = false;
  private failure: Error | undefined;
  private readonly listeners = new Set<() => void>();

  public constructor(private readonly label: string) {}

  /**
   * Append bytes decoded from either original output stream, in arrival order.
   *
   * @evidence contracts/common.md#principled-implementation Each stream is accumulated independently before marker matching, so split chunks join within their original stream and fragments from different streams cannot manufacture a cycle.
   * @evidence contracts/common.md#clear-and-simple-design One append operation updates the arrival transcript and the two marker counts before notifying finite quiet observers.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Counts come from actual supplied stream chunks and the launcher marker grammar, without expected-count substitutions.
   * @evidence contracts/common.md#meaningful-documentation The member identifies the original-stream handoff and arrival-order transcript meaning.
   * @evidence contracts/performance.md#efficient-algorithms Rescanning both accumulated streams costs their total bytes per chunk, plus active observer callbacks; the combined transcript is retained separately for arrival-order diagnostics.
   * @evidence contracts/performance.md#reuse-equivalent-work Every observation reads these same counters instead of independently reparsing the transcript.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Stream and transcript bytes remain for this session lifetime without a byte cap; notification borrows the currently active quiet listeners.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This operation observes JavaScript state; the caller owns native process and stream boundaries.
   */
  public append(chunk: string, stream: "stdout" | "stderr"): void {
    this.output += chunk;
    this.streams[stream] += chunk;
    this.builds = Object.values(this.streams).reduce(
      (count, output) =>
        count + (output.match(/\[ttsc\] watch build (?:complete|failed)/g) ?? []).length,
      0,
    );
    this.starts = Object.values(this.streams).reduce(
      (count, output) =>
        count + (output.match(/\[ttsc\] rebuilding at /g) ?? []).length,
      0,
    );
    this.notify();
  }

  /**
   * Preserve the actual process or stream failure for unmet observations.
   *
   * @evidence contracts/common.md#principled-implementation The first actual Error remains terminal authority for unmet observations; notification does not imply process retirement.
   * @evidence contracts/common.md#clear-and-simple-design One sticky field records failure and the shared notification path wakes finite quiet assertions.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The original Error is preserved rather than converted to a successful or elapsed-time result.
   * @evidence contracts/common.md#meaningful-documentation The headline identifies actual process or stream failure and its observation scope.
   * @evidence contracts/performance.md#efficient-algorithms Recording failure is constant work plus the active quiet listener population.
   * @evidence contracts/performance.md#reuse-equivalent-work All current and later observations use the same first terminal cause.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The first error is retained for this observation owner lifetime; notified quiet observers remove their own handles, while the process owner still joins native work.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This operation observes JavaScript state; the caller owns native process and stream boundaries.
   */
  public fail(error: Error): void {
    this.failure ??= error;
    this.notify();
  }

  /**
   * Record actual launcher/stdio close; this is not descendant join proof.
   *
   * @evidence contracts/common.md#principled-implementation Actual launcher/stdio close makes unmet observations terminal without asserting descendant retirement.
   * @evidence contracts/common.md#clear-and-simple-design One closed flag and shared notification path expose original process closure.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No timer, signal delivery or numeric PID lookup supplies this transition.
   * @evidence contracts/common.md#meaningful-documentation The headline explicitly distinguishes actual launcher close from descendant join proof.
   * @evidence contracts/performance.md#efficient-algorithms Recording close is constant work plus active quiet listeners.
   * @evidence contracts/performance.md#reuse-equivalent-work One sticky terminal state serves every observation of this original process.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Quiet listeners release their timers on this notification; positive polls stop at their next inspection. Native resources remain owned by WatchSession and its containing carrier.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This operation observes JavaScript state; the caller owns native process and stream boundaries.
   */
  public close(): void {
    this.closed = true;
    this.notify();
  }

  /**
   * Return all completed cycles, including cycles that reported diagnostics.
   *
   * @evidence contracts/common.md#principled-implementation Returns the counter computed from actual complete and failed markers, both of which terminate a cycle.
   * @evidence contracts/common.md#clear-and-simple-design The read exposes the count needed to validate the owning shutdown receipt.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A started cycle or expected fixture outcome cannot increase this counter.
   * @evidence contracts/common.md#meaningful-documentation The headline explains that diagnostic-failing cycles are completed cycles too.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This operation observes JavaScript state; the caller owns native process and stream boundaries.
   * @evidenceExclude contracts/performance.md#efficient-algorithms This direct field read chooses no processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This read coordinates no computation or cache.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This read acquires or releases no resource; the enclosing instance owns its retained state.
   */
  public completed(): number {
    return this.builds;
  }

  /**
   * Return the combined output transcript observed so far.
   *
   * @evidence contracts/common.md#principled-implementation Returns observed stdout/stderr chunks in their arrival order without deriving a success result from their text.
   * @evidence contracts/common.md#clear-and-simple-design One read exposes the session diagnostic transcript.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Observed bytes are not replaced by a predicted transcript.
   * @evidence contracts/common.md#meaningful-documentation The headline identifies the combined observed transcript.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This operation observes JavaScript state; the caller owns native process and stream boundaries.
   * @evidenceExclude contracts/performance.md#efficient-algorithms This direct field read chooses no processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This read coordinates no computation or cache.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This read acquires or releases no resource; the enclosing instance owns its retained state.
   */
  public transcript(): string {
    return this.output;
  }

  /**
   * Await a real completion marker or an actual terminal failure.
   *
   * @evidence contracts/common.md#principled-implementation A qualified actual completion count wins; an unmet count remains pending until actual owner error or close.
   * @evidence contracts/common.md#clear-and-simple-design The existing waitFor owns polling and terminal failure routing; this operation supplies only the concrete marker predicate and owner check.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No elapsed age manufactures a missing marker, and no synthetic cycle satisfies the predicate.
   * @evidence contracts/common.md#meaningful-documentation The headline names real markers and actual terminal failure as the observation authority.
   * @evidence contracts/performance.md#efficient-algorithms Each poll reads one counter; the shared waitFor retains one scheduled inspection per active caller.
   * @evidence contracts/performance.md#reuse-equivalent-work Every waiter reads the same session counters; different count goals retain independent observations.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The existing waitFor clears its timer on publication or terminal failure. Operator interruption and native process join remain with the containing native E2E owner.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This operation observes JavaScript state; the caller owns native process and stream boundaries.
   */
  public waitForBuilds(count: number): Promise<void> {
    return waitFor(
      () => this.builds >= count,
      `${this.label} did not reach ${count} builds`,
      { check: () => this.assertRunning() },
    );
  }

  /**
   * Await completed started cycles and a finite window with no additional start.
   * A queued rerun restarts the observation; build duration has no ceiling.
   *
   * @evidence contracts/common.md#principled-implementation Success requires every observed start completed and no new start during the requested quiet interval. A new start resets that interval; actual error or close rejects.
   * @evidence contracts/common.md#clear-and-simple-design A prior-start count and quiet timestamp describe one concrete settled boundary; existing waitFor owns the inspection lifecycle.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The quiet clock asserts a finite absence interval and never caps positive build duration.
   * @evidence contracts/common.md#meaningful-documentation The member explains queued reruns, the finite interval and the absence of a build-duration ceiling.
   * @evidence contracts/performance.md#efficient-algorithms Each inspection compares counters and timestamps in constant work, with one waitFor poll handle per call.
   * @evidence contracts/performance.md#reuse-equivalent-work Settlement reads the shared original-session counters; a new start invalidates only this observation boundary.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Publication or actual terminal failure releases the poll handle; the native containing owner owns operator cancellation and process retirement.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This operation observes JavaScript state; the caller owns native process and stream boundaries.
   */
  public waitForSettled(quiet = 2_000): Promise<void> {
    let starts = this.starts;
    let quietSince = Date.now();
    return waitFor(
      () => {
        this.assertRunning();
        if (this.starts !== starts) {
          starts = this.starts;
          quietSince = Date.now();
        }
        return this.builds >= starts && Date.now() - quietSince >= quiet;
      },
      `${this.label} did not settle`,
      { check: () => this.assertRunning() },
    );
  }

  /**
   * Assert no start or completion arrives during the specified idle interval.
   *
   * @evidence contracts/common.md#principled-implementation Snapshot counts fix the absence assertion; any new start/completion or actual terminal event rejects before the finite idle timer succeeds.
   * @evidence contracts/common.md#clear-and-simple-design One timer and listener share one finish path that removes both observation handles.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The timer proves only no observed activity during its explicit interval, never positive progress or process retirement.
   * @evidence contracts/common.md#meaningful-documentation The headline identifies starts, completions and the finite idle interval.
   * @evidence contracts/performance.md#efficient-algorithms Each notification compares two counters; storage and callbacks scale with concurrent quiet observations.
   * @evidence contracts/performance.md#reuse-equivalent-work The underlying session counts remain shared, while each caller owns its own interval and initial state.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Every success, event, error and already-closed path clears its timer and removes its callback; none of these paths releases native process inputs.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This operation observes JavaScript state; the caller owns native process and stream boundaries.
   */
  public waitForQuiet(duration = 900): Promise<void> {
    const starts = this.starts;
    const builds = this.builds;
    return new Promise<void>((resolve, reject) => {
      const finish = (error?: unknown): void => {
        clearTimeout(timer);
        this.listeners.delete(check);
        if (error === undefined) resolve();
        else reject(error);
      };
      const check = (): void => {
        try {
          this.assertRunning();
          assert.ok(
            this.starts === starts && this.builds === builds,
            `${this.label} rebuilt during an idle period:\n${this.output}`,
          );
        } catch (error) {
          finish(error);
        }
      };
      const timer = setTimeout(() => {
        try {
          this.assertRunning();
          finish();
        } catch (error) {
          finish(error);
        }
      }, duration);
      this.listeners.add(check);
      check();
    });
  }

  /**
   * Reject an unmet observation when its original session has failed or closed.
   *
   * @evidence contracts/common.md#principled-implementation Only the sticky original error or actual close rejects this terminal check; running age has no authority.
   * @evidence contracts/common.md#clear-and-simple-design The shared check serves build, quiet and actual consumer predicates without another observer loop.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Preserves the original error and checks actual closure without process lookup or synthetic progress.
   * @evidence contracts/common.md#meaningful-documentation Names the unmet-observation scope and original session authority.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This check reads JavaScript state; the session owns native events.
   * @evidenceExclude contracts/performance.md#efficient-algorithms This direct terminal-state check chooses no processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This check coordinates no computation or cache.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This check acquires no resource; callers retain their original observation and process owners.
   */
  public assertRunning(): void {
    if (this.failure !== undefined) throw this.failure;
    assert.equal(
      this.closed,
      false,
      `${this.label} exited during observation:\n${this.output}`,
    );
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
