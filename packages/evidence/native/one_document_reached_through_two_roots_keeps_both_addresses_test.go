package evidence

import (
  "testing"
)

/**
 * Verifies one document reached through two roots owns one target per root.
 *
 * Inventories are keyed by file and by base together, and this is the case that
 * proves why. Two populations that reach the same document through different
 * roots address it differently, so a key that named only the file would let the
 * second population overwrite the first — and the citations of whichever lost
 * would stop resolving with nothing in the configuration to explain it.
 *
 *  1. Reference one document twice, once through the project and once rooted.
 *  2. Cite it under both addresses from the same claim.
 *  3. Assert both obligations close.
 *
 * @evidence contracts/testing.md#behavioral-verification runRootedGraph closes both obligations on one document reached through two roots.
 * @evidence contracts/testing.md#independent-expectations The authored docs/pricing.md and pricing.md citations independently address the same heading under separate bases.
 * @evidence contracts/testing.md#distinguishing-cases A physical file must preserve both addresses rather than overwrite an inventory.
 * @evidence contracts/testing.md#execution-ownership TestOneDocumentReachedThroughTwoRootsKeepsBothAddresses is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestOneDocumentReachedThroughTwoRootsKeepsBothAddresses(t *testing.T) {
  messages := runRootedGraph(t, map[string]string{
    "project/docs/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts": "/** @evidence docs/pricing.md#discounts The project population is cited here. */\n" +
      "/** @evidence pricing.md#discounts The rooted population is cited here too. */\n" +
      "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":[
      {"type":"markdown","files":["docs/**"],"symbol":"h2"},
      {"type":"markdown","root":"docs","files":["**"],"symbol":"h2"}
    ]
  }]}`)
  assertNoProblems(t, messages)
}
