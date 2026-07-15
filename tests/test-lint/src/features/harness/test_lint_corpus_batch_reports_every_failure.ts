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
