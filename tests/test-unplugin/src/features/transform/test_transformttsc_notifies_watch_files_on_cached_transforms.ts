import { assertCachedTransformStillNotifiesWatchFiles } from "../../internal/transform-dependencies";

/**
 * Verifies a cache-served transform still notifies the watch hook.
 *
 * The project-scoped transform cache shares one compiler result across
 * sibling-module requests and watch-mode rebuilds, but watch registrations are
 * per module request — a bundler that re-runs the transform hook expects its
 * watch list to be rebuilt. If the cache-hit path skipped the dependency
 * replay, the second build of an unchanged project would silently lose HMR
 * invalidation for type-only inputs (the exact samchon/ttsc#214 failure).
 *
 * 1. Transform once with a shared cache, collecting watch files.
 * 2. Transform the same unchanged file again with the same cache.
 * 3. Assert both runs reported the identical dependency list.
 */
export const test_transformttsc_notifies_watch_files_on_cached_transforms =
  async () => {
    await assertCachedTransformStillNotifiesWatchFiles();
  };
