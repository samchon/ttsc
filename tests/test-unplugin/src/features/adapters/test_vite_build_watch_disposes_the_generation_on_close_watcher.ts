import { assertViteBuildWatchDisposesOnCloseWatcher } from "../../internal/adapter-vite-lifecycle";

/**
 * Verifies the retained generation is disposed at the watch session's teardown.
 *
 * Retaining it across passes means no pass boundary releases its directory
 * watchers any more, so the boundary that genuinely means teardown has to. Of
 * every hook a `vite build --watch` trace produces — `buildEnd`, `writeBundle`
 * and `closeBundle` all repeat per rebuild — `closeWatcher` is the only one
 * that fires exactly once.
 *
 * 1. Drive one rebuild pass and assert a single compile.
 * 2. Invoke `closeWatcher`, then start a fresh pass and deliver again.
 * 3. Assert the second session compiled, proving the generation was disposed.
 */
export const test_vite_build_watch_disposes_the_generation_on_close_watcher =
  async () => {
    await assertViteBuildWatchDisposesOnCloseWatcher();
  };
