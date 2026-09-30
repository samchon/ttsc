package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a root that names no directory is reported as a root rather than as
 * an empty glob match.
 *
 * The likeliest mistake this property introduces is a root off by one segment,
 * and the population it selects is then empty for a reason no pattern explains.
 * The diagnostic therefore names both spellings: the property the author edits
 * and the location it actually landed on.
 *
 *  1. Declare a root one segment away from the documents.
 *  2. Read the diagnostics.
 *  3. Assert the root is named as written and as resolved.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runRootedGraph names absent ../documents and suppresses matched-no-markdown-files noise.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Fixture docs exists while declared documents does not.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Unreadable root differs from healthy empty selection.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestAnUnreadableRootIsReportedAsARoot is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestAnUnreadableRootIsReportedAsARoot(t *testing.T) {
  messages := runRootedGraph(t, map[string]string{
    "docs/requirements/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":          "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "root":"../documents",
      "files":["requirements/**"],
      "symbol":"h2"
    }
  }]}`)
  assertProblemContains(
    t,
    messages,
    "could not read the markdown root '../documents', which resolves to '",
  )
  if countProblemsContaining(messages, "matched no markdown files") != 0 {
    t.Fatalf(
      "an unreadable root must not cascade into a healthy empty-match diagnostic:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}
