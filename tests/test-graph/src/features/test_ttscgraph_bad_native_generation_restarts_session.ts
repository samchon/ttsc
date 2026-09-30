import {
  createNativeSessionFixture,
  processIsAlive,
  readPids,
  waitFor,
} from "../internal/nativeSession";
import { assert } from "../internal/ttsgraph";

/**
 * Verifies a false native generation digest retires the whole child.
 *
 * A shard manifest can be internally consistent while the advertised generation
 * is false. Accepting that coordinate would let the next delta claim a base the
 * client never proved, so the transaction is rejected before publication and
 * the process is replaced.
 *
 * 1. Make the first fake process publish valid shards under a false generation.
 * 2. Assert the call rejects and that child exits.
 * 3. Assert the next call starts a replacement process and succeeds.
 *
 * @evidence contracts/testing.md#behavioral-verification The built TtscGraphSession rejects a shard bearing wrong-generation, observes the first child dead, and obtains an empty graph from exactly one replacement child.
 * @evidence contracts/testing.md#independent-expectations Literal incompatible generation and PID/graph assertions define a valid generation boundary; no expected generation is calculated by the client's implementation.
 * @evidence contracts/testing.md#distinguishing-cases One corrupt first generation contrasts the valid replacement. A failed frame must retire the process rather than poison the next request.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_bad_native_generation_restarts_session loads the built TtscGraphSession and spawns the shared compiled Go protocol stand-in; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Actual stdio framing, shard generation validation and process retirement/restart must connect. The Go peer is a protocol stand-in, not a compiler graph producer.
 * @evidence contracts/e2e.md#shared-execution All native-session cases reuse nativeSession's memoized Go stand-in artifact. This first-corruption marker requires a fresh child/session; replacement requests reuse its fixture, and broader batching remains incomplete.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Case-owned mode, marker and PID logs preserve a cold corrupt first reply. finally closes the session; the test explicitly waits for first-child death and two recorded children.
 * @evidence contracts/e2e.md#preserved-coverage Original wrong-generation rejection, old PID death, empty recovered nodes and exact two-child assertions remain.
 */
export const test_ttscgraph_bad_native_generation_restarts_session =
  async () => {
    const { root, session } = createNativeSessionFixture({
      mode: "bad-shard-generation-once",
    });
    try {
      await assert.rejects(
        session.graph(),
        /native generation wrong-generation/,
      );
      const firstPid = readPids(root)[0]!;
      await waitFor(
        () => !processIsAlive(firstPid),
        "bad-generation child exit",
      );
      const graph = await session.graph();
      assert.deepEqual(graph.nodes, []);
      assert.equal(readPids(root).length, 2);
    } finally {
      session.close();
    }
  };
