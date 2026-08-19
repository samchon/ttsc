import { DUMP_SCHEMA_VERSION } from "@ttsc/graph";

import { createNativeSessionFixture } from "../internal/nativeSession";
import { assert } from "../internal/ttsgraph";

/**
 * Verifies the current consumer refuses the prior path vocabulary precisely.
 *
 * Schema v5 can carry checkout-local absolute sibling paths and collapsed
 * package tails, so accepting it as current would reintroduce ambiguous
 * identity at the client boundary. The body version is checked separately from
 * the serve envelope version and must name both sides of the mismatch.
 *
 * 1. Serve an otherwise valid protocol-v1 snapshot whose dump says schema 5.
 * 2. Request the resident graph.
 * 3. Require an explicit producer-v5/client-current error.
 */
export const test_ttscgraph_rejects_schema_v5_snapshot = async () => {
  const { session } = createNativeSessionFixture({
    mode: "respond",
    schemaVersion: 5,
  });
  try {
    await assert.rejects(
      session.graph(),
      // The client version is read from the constant that defines it, not
      // spelled here. It was spelled here, and the moment the schema moved this
      // case failed for the one reason it was never meant to detect — the
      // third copy of a version #1250 warned would drift the day it moved.
      new RegExp(
        `ttscgraph sends dump schema v5, this client reads v${String(DUMP_SCHEMA_VERSION)}`,
      ),
    );
  } finally {
    session.close();
  }
};
