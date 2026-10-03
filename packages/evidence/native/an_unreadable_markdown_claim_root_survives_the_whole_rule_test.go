package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies an unreadable Markdown claim root survives the whole rule.
 *
 * The unit test over activation now records the population failure itself,
 * because that is what the loader hands it, and a fixture that builds its own
 * inputs can drift from the pipeline that fills them. This runs the real rule
 * so the claim-side path is proved rather than assumed: the claim must stay
 * active long enough for the root to be named, and the empty-match diagnostic
 * must not arrive beside it.
 *
 *  1. Root a Markdown claim at a directory that does not exist.
 *  2. Run the rule.
 *  3. Assert the root is named and no empty-match diagnostic follows.
 *
 * @evidence contracts/testing.md#behavioral-verification runRootedGraph preserves unreadable Markdown claim-root failure without healthy empty-match noise.
 * @evidence contracts/testing.md#independent-expectations The deliberately absent directory establishes the failure state.
 * @evidence contracts/testing.md#distinguishing-cases Unreadable root must survive inactive-claim filtering.
 * @evidence contracts/testing.md#execution-ownership TestAnUnreadableMarkdownClaimRootSurvivesTheWholeRule is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestAnUnreadableMarkdownClaimRootSurvivesTheWholeRule(t *testing.T) {
  messages := runRootedGraph(t, map[string]string{
    "project/docs/pricing.md": "## Discounts {#discounts}\n",
  }, `{"claims":[{
    "type":"markdown",
    "root":"../nowhere",
    "files":["**/*.md"],
    "symbol":"h2",
    "reference":{"type":"markdown","files":["docs/**"],"symbol":"h3"}
  }]}`)
  assertProblemContains(
    t,
    messages,
    "could not read the markdown root '../nowhere', which resolves to '",
  )
  if countProblemsContaining(messages, "matched no markdown files for") != 0 {
    t.Fatalf(
      "an unreadable claim root must not cascade into an empty-match diagnostic:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}
