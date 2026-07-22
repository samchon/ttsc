import { createNativeSessionFixture } from "../internal/nativeSession";
import { assert } from "../internal/ttsgraph";

/**
 * Verifies the schema-v6 consumer refuses the prior path vocabulary precisely.
 *
 * Schema v5 can carry checkout-local absolute sibling paths and collapsed
 * package tails, so accepting it as v6 would reintroduce ambiguous identity at
 * the client boundary. The body version is checked separately from the serve
 * envelope version and must name both sides of the mismatch.
 *
 * 1. Serve an otherwise valid protocol-v1 snapshot whose dump says schema 5.
 * 2. Request the resident graph.
 * 3. Require an explicit producer-v5/client-v6 error.
 */
export const test_ttscgraph_rejects_schema_v5_snapshot = async () => {
  const { session } = createNativeSessionFixture({
    mode: "respond",
    requestTimeoutMs: 5_000,
    schemaVersion: 5,
  });
  try {
    await assert.rejects(
      session.graph(),
      /ttscgraph sends dump schema v5, this client reads v6/,
    );
  } finally {
    session.close();
  }
};
