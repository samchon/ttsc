package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies the accessor's obligation is real rather than absent.
 *
 * An operation that materializes no unit at all would also be silent when
 * nobody cites it, which is indistinguishable from the fix above and is the
 * failure mode this product exists to prevent. Removing the citation must
 * therefore leave exactly one missing acknowledgement, named for the accessor.
 *
 *  1. Publish the same accessor with no citation anywhere.
 *  2. Evaluate the graph.
 *  3. Assert one missing acknowledgement, for the accessor itself.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule over the merged-accessor fixture with a function reference over src/index.ts and a test host citing nothing; the test requires exactly one `Missing acknowledgement` and that it is `Missing acknowledgement for 'functional.health.get' (TypeScript function 'get'`.
 * @evidence contracts/testing.md#independent-expectations The expected single message and its address are authored from the unit-model contract: the accessor is one real unit, so an uncited accessor owes exactly one acknowledgement, which distinguishes a real unit from one that materialized nothing and is silent either way.
 * @evidence contracts/testing.md#distinguishing-cases The uncited counterpart of TestGraphResolvesAFunctionMergedAccessorToOneUnit: the same files, no citation, so the one-unit claim is checked from the owed side.
 * @evidence contracts/testing.md#execution-ownership TestGraphStillOwesTheFunctionMergedAccessorItself is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestGraphStillOwesTheFunctionMergedAccessorItself(t *testing.T) {
  files := mergedAccessorFiles()
  files["test/health.ts"] = "export function test_health(): void {}\n"
  messages := runIndexRule(t, files, `{"claims":[{
    "type":"typescript",
    "files":["test/**"],
    "symbol":"function",
    "reference":{"type":"typescript","files":["src/index.ts"],"symbol":["function"]}
  }]}`)
  if count := countProblemsContaining(messages, "Missing acknowledgement"); count != 1 {
    t.Fatalf(
      "expected the accessor to owe exactly one acknowledgement, got %d:\n%s",
      count,
      strings.Join(messages, "\n"),
    )
  }
  assertProblemContains(
    t,
    messages,
    "Missing acknowledgement for 'functional.health.get' (TypeScript function 'get'",
  )
}
