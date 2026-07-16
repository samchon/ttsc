import { assertWebpackWatchRebuildsThroughTypeOnlyEdge } from "../../internal/adapter-webpack";

/**
 * Verifies webpack watch mode re-runs the consumer's loader when a file
 * reachable only through a type-only graph edge changes.
 *
 * Acceptance scenario of samchon/ttsc#716: watch graphs compare the same
 * per-module `fileDependencies` set as the persistent cache, so an unregistered
 * type-only input means HMR serves stale generated code until a cold restart.
 * The graph-derived watch registration must therefore reach the live watcher,
 * not only the cache snapshot.
 *
 * 1. Start webpack in polling watch mode on the reproduction project with the
 *    producer emitting the graph edge.
 * 2. After the first compilation, edit the type file.
 * 3. Assert a subsequent compilation embeds the new interface member, then close
 *    the watcher.
 */
export const test_webpack_watch_rebuilds_through_a_type_only_edge =
  async () => {
    await assertWebpackWatchRebuildsThroughTypeOnlyEdge();
  };
