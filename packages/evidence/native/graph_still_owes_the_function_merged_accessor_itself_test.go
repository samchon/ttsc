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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert one missing acknowledgement, for the accessor itself.
 * @evidence contracts/testing.md#independent-expectations An operation that materializes no unit at all would also be silent when nobody cites it, which is indistinguishable from the fix above and is the failure mode this product exists to prevent. Removing the citation must therefore leave exactly one missing acknowledgement, named for the accessor. The authored scenario requires this outcome: Assert one missing acknowledgement, for the accessor itself.
 * @evidence contracts/testing.md#distinguishing-cases Publish the same accessor with no citation anywhere. Evaluate the graph. Assert one missing acknowledgement, for the accessor itself.
 * @evidence contracts/testing.md#execution-ownership TestGraphStillOwesTheFunctionMergedAccessorItself runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
