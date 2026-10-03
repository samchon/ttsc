package evidence

import (
  "testing"
)

/**
 * Verifies the two sides default to different selections.
 *
 * A reference default is a promise about the denominator, so it takes the
 * coarsest one: selecting every column by default would put `id`, `created_at`,
 * and every back-reference into the obligation set, and a denominator that
 * large teaches an author to write filler reasons. A claim default is the
 * widest, because there the selector narrows where a citation may sit rather
 * than what must be covered.
 *
 *  1. Decode a Prisma claim and reference with no `symbol`.
 *  2. Assert the reference selects models alone.
 *  3. Assert the claim selects all three host kinds.
 *
 * @evidence contracts/testing.md#behavioral-verification decodePrismaConfig defaults references to model and claims to model,column,relation.
 * @evidence contracts/testing.md#independent-expectations Literal expected selector names express the default contract independently.
 * @evidence contracts/testing.md#distinguishing-cases Omission has different claim/reference semantics.
 * @evidence contracts/testing.md#execution-ownership TestPrismaConfigurationDefaultsDifferPerSide is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaConfigurationDefaultsDifferPerSide(t *testing.T) {
  config, problems := decodePrismaConfig(t, `{"claims":[{
    "type":"prisma",
    "files":["prisma/**/*.prisma"],
    "reference":{"type":"prisma","files":["prisma/**/*.prisma"]}
  }]}`)
  if len(problems) != 0 {
    t.Fatalf("defaults must decode: %v", problems)
  }
  if got := config.Claims[0].References[0].Symbols.names(); got != "model" {
    t.Fatalf("reference default: %q, want \"model\"", got)
  }
  if got := config.Claims[0].Symbols.names(); got != "model, column, relation" {
    t.Fatalf("claim default: %q, want \"model, column, relation\"", got)
  }
}
