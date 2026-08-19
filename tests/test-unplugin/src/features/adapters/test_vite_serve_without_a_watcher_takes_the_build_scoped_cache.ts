import { assertWatcherlessServeTakesTheBuildScopedCache } from "../../internal/adapter-vite-lifecycle";

/**
 * Verifies a dev server with no watcher gets the build-scoped cache lifecycle.
 *
 * Pins the `buildStart` branch in `core/index.ts`: `server.watch: null` leaves
 * the session no channel through which any edit could arrive, so persistent
 * per-delivery validation proves the absence of changes nobody could make. That
 * is the `vitest --run` workload behind samchon/ttsc#970 and
 * samchon/ttsc#1260.
 *
 * 1. Resolve the adapter's config as `command: "serve"` with `watch: null` and run
 *    `buildStart`.
 * 2. Deliver one module, then change a project input the validation covers.
 * 3. Deliver every remaining module and assert the fixture plugin still ran one
 *    whole-project compile.
 */
export const test_vite_serve_without_a_watcher_takes_the_build_scoped_cache =
  async () => {
    await assertWatcherlessServeTakesTheBuildScopedCache();
  };
