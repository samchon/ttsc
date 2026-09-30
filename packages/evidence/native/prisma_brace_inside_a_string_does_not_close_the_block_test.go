package evidence

import (
  "testing"
)

/**
 * Verifies a brace inside a string literal does not close the block.
 *
 * `@default("}")` is a legal column, and a scan that counted braces literally
 * would end the model there — silently moving every member below it out of the
 * block and, if another block follows, attributing them to it. The result is a
 * location that is wrong rather than missing, on a schema that is perfectly
 * valid.
 *
 *  1. Scan a model whose column defaults to a closing brace.
 *  2. Assert the members after it still belong to that model.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification scanPrismaSchema preserves checked member positions after a quoted brace.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Literal string brace and expected declaration lines establish lexical meaning.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases A brace inside a string must not end a model block.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaBraceInsideAStringDoesNotCloseTheBlock is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaBraceInsideAStringDoesNotCloseTheBlock(t *testing.T) {
  locations := prismaLocationsOf(`model Sale {
  note  String @default("}")
  price Int
}
`)
  assertPrismaLine(t, locations, "Sale.note", 2)
  assertPrismaLine(t, locations, "Sale.price", 3)
}
