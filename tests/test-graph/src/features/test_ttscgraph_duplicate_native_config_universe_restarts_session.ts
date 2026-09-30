import {
  createNativeSessionFixture,
  processIsAlive,
  readPids,
  waitFor,
} from "../internal/nativeSession";
import { assert } from "../internal/ttsgraph";

/**
 * Verifies duplicate universe inputs cannot conceal an undeclared config shard.
 *
 * Locks the config-coverage check as a bijection instead of two same-sized
 * collections. Otherwise one repeated config can balance one hidden input.
 *
 * 1. Publish two config shards but describe the first input twice in universe.
 * 2. Reject the non-bijective coverage and wait for the child to exit.
 * 3. Start a clean child and accept its complete initial generation.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphSession rejects a configuration shard whose repeated universe input disagrees with its declared universe, retires its child and recovers empty nodes on a replacement.
 * @evidence contracts/testing.md#independent-expectations Authored repeated tsconfig input and mismatching universe are independent invalid data; literal error text and PID observations distinguish successful rejection from transport-only failure.
 * @evidence contracts/testing.md#distinguishing-cases Malformed first universe contrasts a valid fresh process. The case covers config-shard coherence, separate from duplicate manifest ordering.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_duplicate_native_config_universe_restarts_session loads the built TtscGraphSession and spawns the shared compiled Go protocol stand-in; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Real protocol payload assembly, shard-store coherence checks and session restart must connect; this Go stand-in does not run a TypeScript checker.
 * @evidence contracts/e2e.md#shared-execution One memoized protocol-peer artifact is reused across native cases. First-only universe corruption needs a cold child and isolated marker; recovery reuses the fixture, and broader batching is incomplete.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Case-specific config/PID files prevent another case from consuming the first-only fault; finally closes the session and explicit old-PID polling checks retirement.
 * @evidence contracts/e2e.md#preserved-coverage Original universe disagreement rejection, dead original PID, recovered empty nodes and two-child assertions remain executable.
 */
export const test_ttscgraph_duplicate_native_config_universe_restarts_session =
  async () => {
    const { root, session } = createNativeSessionFixture({
      mode: "duplicate-config-universe-once",
    });
    try {
      await assert.rejects(
        session.graph(),
        /config shard disagrees with universe input tsconfig\.json/,
      );
      const firstPid = readPids(root)[0]!;
      await waitFor(
        () => !processIsAlive(firstPid),
        "duplicate-config child exit",
      );
      const graph = await session.graph();
      assert.deepEqual(graph.nodes, []);
      assert.equal(readPids(root).length, 2);
    } finally {
      session.close();
    }
  };
