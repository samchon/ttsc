import {
  createNativeSessionFixture,
  processIsAlive,
  readPids,
  waitFor,
} from "../internal/nativeSession";
import { assert } from "../internal/ttsgraph";

/**
 * Verifies a timeout discards graph memory owned by the retired child.
 *
 * The resident model and native Program describe one process generation. A
 * restart must not keep the old model available while the replacement session
 * is establishing its own initial snapshot.
 *
 * 1. Let the first child answer once, then stall on its next request.
 * 2. Assert the timeout kills that child and clears the private resident model.
 * 3. Assert a replacement child publishes a new resident graph.
 */
export const test_ttscgraph_native_timeout_clears_resident_memory =
  async () => {
    const { root, session } = createNativeSessionFixture({
      mode: "respond-then-hang",
      requestTimeoutMs: 1_000,
    });
    try {
      const initial = await session.graph();
      await assert.rejects(session.graph(), /timed out after 1000 ms/);
      const current = () =>
        (
          session as unknown as {
            current: unknown;
          }
        ).current;
      assert.equal(current(), undefined);
      const firstPid = readPids(root)[0]!;
      await waitFor(
        () => !processIsAlive(firstPid),
        "retired model owner exit",
      );
      const replacement = await session.graph();
      assert.notEqual(replacement, initial);
      assert.equal(current(), replacement);
      assert.equal(readPids(root).length, 2);
    } finally {
      session.close();
    }
  };
