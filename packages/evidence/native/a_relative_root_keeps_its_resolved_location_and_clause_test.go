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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runRootedGraph is exercised with the scenario below; the assertions require the resolved location and the resolution clause are both present.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The negative twin of the complementary case, and the one the repair could most easily overrun. A relative root is the form where the derived spelling is the author's own and where the project root actually is composed into it, so every clause the absolute case drops has to survive here.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Declare the same claim with an ascending relative root. Read the root diagnostic. Assert the resolved location and the resolution clause are both present.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestARelativeRootKeepsItsResolvedLocationAndClause is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
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
