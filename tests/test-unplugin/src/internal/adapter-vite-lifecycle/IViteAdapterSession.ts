/**
 * One driven Vite adapter session over a multi-module fixture project.
 *
 * The cache lifecycle is a decision the adapter makes in `buildStart` from the
 * resolved config, so a scenario that asserts it needs a resolved config and a
 * transform context, not a running server. Driving the hooks directly also
 * keeps every scenario free of a live chokidar watcher, which can outlive
 * `server.close()` and hold the test runner process open.
 */
export interface IViteAdapterSession {
  /** End the driven Vite lifecycle and dispose its private cache. */
  close: () => Promise<void>;
  /** Deliver one module through the adapter's `transform` hook. */
  deliver: (file: string) => Promise<unknown>;
  /** Absolute module paths of the fixture, sorted. */
  modules: string[];
  /** How many whole-project compiles the fixture plugin has run so far. */
  projectCompiles: () => number;
  /** Absolute path of one project input that is not a module source. */
  unrelatedInput: string;
}
