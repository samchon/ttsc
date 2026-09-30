package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies an unresolvable TypeScript claim root is reported as a root.
 *
 * The Markdown half of this pair has always worked, because its loader meets
 * the root before it lists anything. TypeScript materializes from ctx.Sources
 * and walks nothing, so the population came back healthy and empty and the
 * author was answered with `matched no typescript files` and a lecture on glob
 * syntax — for a mistake that is one directory name, and after the rule had
 * already computed the right sentence and used it as a boolean.
 *
 *  1. Declare a TypeScript claim rooted at a directory that does not exist.
 *  2. Read the diagnostics.
 *  3. Assert the root is named and the glob diagnostic is suppressed.
 *
 * @evidence contracts/testing.md#behavioral-verification runRootedGraph retains the TypeScript claim-root failure and suppresses empty-match noise.
 * @evidence contracts/testing.md#independent-expectations The fixture never creates the root and the required message is literal.
 * @evidence contracts/testing.md#distinguishing-cases Root failure survives whole-rule source selection.
 * @evidence contracts/testing.md#execution-ownership TestAnUnresolvableTypeScriptClaimRootIsReportedAsARoot is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestAnUnresolvableTypeScriptClaimRootIsReportedAsARoot(t *testing.T) {
  messages := runRootedGraph(t, map[string]string{
    "project/docs/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":     "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "root":"../nowhere",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**"],"symbol":"h2"}
  }]}`)
  assertProblemContains(
    t,
    messages,
    "found no directory at the typescript root '../nowhere', which resolves to '",
  )
  if countProblemsContaining(messages, "matched no typescript files") != 0 {
    t.Fatalf(
      "an unresolvable root must not cascade into a healthy empty-match diagnostic:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}
