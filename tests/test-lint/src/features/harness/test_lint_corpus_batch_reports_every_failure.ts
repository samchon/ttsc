import assert from "node:assert/strict";

import { assertLintCases } from "../../helpers/assertLintCase";

/**
 * Verifies lint corpus batches: one failed fixture does not hide later
 * failures.
 *
 * A fail-fast partition forced the entire native corpus lane to restart for
 * every stale fixture contract. The batch must finish its sweep and preserve
 * each fixture's identity in the aggregate report.
 *
 * 1. Assert two deliberately missing fixture paths as one batch.
 * 2. Capture the aggregate failure after both paths have been attempted.
 * 3. Assert the report retains both failures in input order.
 *
 * @evidence contracts/testing.md#behavioral-verification assertLintCases attempts both missing fixtures and preserves their ordered identities in one AggregateError rather than stopping after the first failure.
 * @evidence contracts/testing.md#independent-expectations The two deliberately nonexistent fixture names independently define the expected ordered errors; the test does not derive its expected report from discovery.
 * @evidence contracts/testing.md#distinguishing-cases A batch contains two separate failures; each error prefix and the exact error count are checked. Successful fixture execution is owned by the corpus engine tests.
 * @evidence contracts/testing.md#execution-ownership Calls the synchronous authored batch helper with missing inputs, so failure occurs before any native host or compiler can start.
 */
export const test_lint_corpus_batch_reports_every_failure = (): void => {
  let thrown: unknown;
  try {
    assertLintCases(["__missing__/first.ts", "__missing__/second.ts"]);
  } catch (error) {
    thrown = error;
  }

  assert.ok(thrown instanceof AggregateError);
  assert.equal(thrown.errors.length, 2);
  assert.deepEqual(
    thrown.errors.map((error) =>
      error instanceof Error ? error.message.split(":", 1)[0] : error,
    ),
    ["__missing__/first.ts", "__missing__/second.ts"],
  );
};
