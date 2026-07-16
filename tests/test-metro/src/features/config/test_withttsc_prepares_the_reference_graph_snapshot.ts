import { assertWithTtscPreparesTheSnapshot } from "../../internal/metro-cache";

/**
 * Verifies `withTtsc` prepares the reference-graph snapshot at config load.
 *
 * The config process is the single race-free moment before workers exist, and
 * an existing snapshot is what keeps an unchanged project's cache key stable
 * from the second run onward (no snapshot means a per-run nonce).
 *
 * 1. Call `withTtsc` on a config pointing at a fresh project root.
 * 2. Assert the transformer path is set (the config contract is untouched).
 * 3. Assert the main snapshot exists with a non-empty epoch id and no files.
 */
export const test_withttsc_prepares_the_reference_graph_snapshot = async () => {
  await assertWithTtscPreparesTheSnapshot();
};
