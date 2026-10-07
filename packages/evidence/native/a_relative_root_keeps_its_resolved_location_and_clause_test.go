package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a relative declared root still carries both spellings and the clause
 * that explains them.
 *
 * The negative twin of the complementary case, and the one the repair could most easily
 * overrun. A relative root is the form where the derived spelling is the
 * author's own and where the project root genuinely is composed into it, so
 * every clause the absolute case drops has to survive here.
 *
 *  1. Declare the same claim with an ascending relative root.
 *  2. Read the root diagnostic.
 *  3. Assert the resolved location and the resolution clause are both present.
 *
 * @evidence contracts/testing.md#behavioral-verification runRootedGraph runs the graph rule with a TypeScript claim whose root is the missing relative path `../contracts`; the test requires diagnostics containing `found no directory at the typescript root '../contracts', which resolves to '`, `it resolves against the ttsc project root` and `add that directory and make its sources part of the tsconfig Program`, and none containing `because that path is not a directory`.
 * @evidence contracts/testing.md#independent-expectations The expected sentences are authored literals for a relative root that holds nothing: the author's spelling, the resolved location and the project-root clause must all appear, and the occupied-by-a-file wording must not.
 * @evidence contracts/testing.md#distinguishing-cases The negative twin of the absolute-root and non-directory cases: a relative root that does not exist must keep both spellings and the resolution clause and must not use the file-in-the-way repair wording.
 * @evidence contracts/testing.md#execution-ownership TestARelativeRootKeepsItsResolvedLocationAndClause is a Go unit entry in the native test process; runRootedGraph writes the fixture to a temp workspace and calls the graph rule directly, with no consumer install or product host.
 */
func TestARelativeRootKeepsItsResolvedLocationAndClause(t *testing.T) {
  messages := runRootedGraph(t, map[string]string{
    "project/docs/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":     "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "root":"../contracts",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**"],"symbol":"h2"}
  }]}`)
  assertProblemContains(
    t,
    messages,
    "found no directory at the typescript root '../contracts', which resolves to '",
  )
  assertProblemContains(t, messages, "it resolves against the ttsc project root")
  assertProblemContains(
    t,
    messages,
    "add that directory and make its sources part of the tsconfig Program",
  )
  if countProblemsContaining(messages, "because that path is not a directory") != 0 {
    t.Fatalf(
      "nothing occupies a path that holds nothing:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}
