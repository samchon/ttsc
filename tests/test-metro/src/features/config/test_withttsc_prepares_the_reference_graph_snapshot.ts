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
 *
 * @evidence contracts/testing.md#behavioral-verification withTtsc creates a main snapshot with a nonempty identity and empty out-of-walk set before any worker runs.
 * @evidence contracts/testing.md#independent-expectations Config preparation owns the initial snapshot epoch; string/nonempty identity and exact empty files are independent initialization expectations.
 * @evidence contracts/testing.md#distinguishing-cases A fresh pluginless project pins the cold preparation state; worker observations and recovery are separate source entries.
 * @evidence contracts/testing.md#execution-ownership This matching src/features export calls authored Metro operations through the source-unit loader. Input filesystem/module fixtures and declared upstream callbacks remain test-local; no installed consumer, native compiler or product host is launched.
 */
export const test_withttsc_prepares_the_reference_graph_snapshot = async () => {
  await assertWithTtscPreparesTheSnapshot();
};
