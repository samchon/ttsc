package evidence

import (
  "testing"
)

/**
 * Verifies a symbol from another artifact kind is rejected by name.
 *
 * Symbol sets are per artifact kind, and a Markdown or TypeScript symbol on a
 * Prisma selector would otherwise select nothing at all — a reference with an
 * empty denominator, which passes every obligation it has.
 *
 *  1. Select a TypeScript symbol on a Prisma reference.
 *  2. Assert the rejection names the kind and lists what is supported.
 *
 * @evidence contracts/testing.md#behavioral-verification decodePrismaConfig reports the asserted unsupported-symbol repair.
 * @evidence contracts/testing.md#independent-expectations The literal foreign symbol lies outside supported model/column/relation selection.
 * @evidence contracts/testing.md#distinguishing-cases Invalid symbols cannot silently become valid members.
 * @evidence contracts/testing.md#execution-ownership TestPrismaConfigurationRejectsAForeignSymbol is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaConfigurationRejectsAForeignSymbol(t *testing.T) {
  _, problems := decodePrismaConfig(t, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "reference":{"type":"prisma","files":["prisma/**"],"symbol":"type"}
  }]}`)
  assertProblemContains(t, problems, "symbol 'type' is not supported for prisma")
}
