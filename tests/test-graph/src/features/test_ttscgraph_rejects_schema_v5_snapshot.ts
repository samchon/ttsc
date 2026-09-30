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
 *
 * @evidence contracts/testing.md#behavioral-verification The built TtscGraphSession rejects a valid protocol response carrying graph schema version five instead of its current public schema version.
 * @evidence contracts/testing.md#independent-expectations The literal old version is independently incompatible with the public graph protocol; the expected error includes the client version but does not generate a replacement accepted snapshot.
 * @evidence contracts/testing.md#distinguishing-cases Well-framed but stale-schema input exercises version rejection rather than JSON parsing; this case has no successful-current-version control of its own.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_rejects_schema_v5_snapshot loads the built TtscGraphSession and spawns the shared compiled Go protocol stand-in; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary An actual child response must pass framing and reach graph-version validation through the built client; the Go peer is a schema-protocol fixture, not the real compiler.
 * @evidence contracts/e2e.md#shared-execution One memoized stand-in artifact serves native-session cases; this stale-schema mode has one isolated child, while current-version controls exist in sibling cases. Overall session batching is incomplete.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The case owns its schema-mode config and never warms a current graph first; finally closes the session and TestProject tracks fixture cleanup.
 * @evidence contracts/e2e.md#preserved-coverage The original precise schema-version rejection remains. No stale graph acceptance or rewritten expected version weakens the compatibility boundary.
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
