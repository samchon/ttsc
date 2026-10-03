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
 * @evidence contracts/testing.md#behavioral-verification After withTtsc({ projectRoot, transformer: {} }) on a fresh temp project, the returned config has a string babelTransformerPath and node_modules/.cache/ttsc-metro/graph-inputs.json exists with a non-empty string id and an empty files list.
 * @evidence contracts/testing.md#independent-expectations Cold-start preparation is checked against literals from the snapshot contract: a non-empty string epoch id and files equal to []; the id value itself is random and is not compared.
 * @evidence contracts/testing.md#distinguishing-cases Only the cold, plugin-less project is exercised; worker observations, recovery and later epochs are covered by other cache entries.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls withTtsc from packages/metro source in-process on a temp project, restoring the TTSC_METRO_OPTIONS and transform-session environment afterwards; no native compile, consumer install or Metro host.
 */
export const test_withttsc_prepares_the_reference_graph_snapshot = async () => {
  await assertWithTtscPreparesTheSnapshot();
};
