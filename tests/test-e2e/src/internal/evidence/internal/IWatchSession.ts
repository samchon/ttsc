import type { IRunResult } from "../../../../../utils/src/evidence/IRunResult";

/**
 * A live `ttsc check --watch` process, driven one rebuild at a time.
 *
 * Watch mode is the only place this plugin's freshness is observable end to
 * end, and it is observable only as a sequence: a build happens, the fixture
 * changes, another build happens. A one-shot result cannot express that, so a
 * session hands back one build at a time instead of one transcript at the end.
 *
 * {@link nextBuild} and {@link expectNoBuild} are opposite halves of the same
 * assertion. A watch that rebuilds for everything and a watch that rebuilds for
 * nothing both look correct through one of them alone.
 */
export interface IWatchSession {
  /**
   * Waits for the next rebuild to finish and returns everything it printed.
   *
   * The result's status mirrors a one-shot `ttsc check` of the same filesystem
   * state — `0` when the rebuild reported no diagnostic and `2` when it did —
   * so the same assertions apply to both paths and the two can be compared.
   */
  readonly nextBuild: (timeout?: number) => Promise<IRunResult>;

  /**
   * Requires that no rebuild starts within the window, and returns what was
   * printed during it.
   *
   * This is how an over-broad watch is caught. A declaration that publishes
   * more than it reads still passes every freshness case; it fails only when
   * something asserts that an unrelated file changed nothing.
   */
  readonly expectNoBuild: (milliseconds: number) => Promise<IRunResult>;

  /** Stops the watcher and waits for the process to exit. */
  readonly close: () => Promise<void>;
}
