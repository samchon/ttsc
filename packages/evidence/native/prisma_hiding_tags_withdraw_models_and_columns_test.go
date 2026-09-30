package evidence

import (
  "testing"
)

/**
 * Verifies a Prisma model or field carrying the tag leaves the population, and
 * that a tagged model takes its members with it.
 *
 * A schema author marking a model internal has made the same declaration a
 * TypeScript author makes with the same tag, and honoring one artifact kind
 * while ignoring the other would make the rule depend on where a declaration
 * happens to live. The untagged column beside the tagged one is what proves the
 * cascade is the model's doing rather than the file's.
 *
 *  1. Materialize a model whose own documentation carries the tag.
 *  2. Materialize an untagged model with one tagged column.
 *  3. Assert the whole first model is withdrawn and only the tagged column of
 *     the second.
 * @evidence contracts/testing.md#behavioral-verification prismaModelUnits exercises the authored fixture. Assert the whole first model is withdrawn and only the tagged column of the second.
 * @evidence contracts/testing.md#independent-expectations A schema author marking a model internal has made the same declaration a TypeScript author makes with the same tag, and honoring one artifact kind while ignoring the other would make the rule depend on where a declaration happens to live. The untagged column beside the tagged one is what proves the cascade is the model's doing rather than the file's. The authored scenario requires this outcome: Assert the whole first model is withdrawn and only the tagged column of the second.
 * @evidence contracts/testing.md#distinguishing-cases Materialize a model whose own documentation carries the tag. Materialize an untagged model with one tagged column. Assert the whole first model is withdrawn and only the tagged column of the second.
 * @evidence contracts/testing.md#execution-ownership TestPrismaHidingTagsWithdrawModelsAndColumns runs as a Go unit entry in the native package. prismaModelUnits executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestPrismaHidingTagsWithdrawModelsAndColumns(t *testing.T) {
  for _, tag := range hiddenTagCases {
    t.Run(tag, func(t *testing.T) {
      for _, unit := range prismaModelUnits(prismaModel{
        Name:          "Ledger",
        Documentation: tag + " Internal bookkeeping.",
        Fields: []prismaField{
          {Name: "amount", Symbol: "column"},
          {Name: "sale", Symbol: "relation"},
        },
      }) {
        if unit.Hidden != tag {
          t.Fatalf("%s must be withdrawn by %s, got %q", unit.Target, tag, unit.Hidden)
        }
      }

      hidden := map[string]string{}
      for _, unit := range prismaModelUnits(prismaModel{
        Name: "Sale",
        Fields: []prismaField{
          {Name: "price", Symbol: "column"},
          {
            Name:          "secret",
            Symbol:        "column",
            Documentation: tag + " Internal bookkeeping.",
          },
        },
      }) {
        hidden[unit.Target] = unit.Hidden
      }
      if hidden["prisma:Sale"] != "" || hidden["prisma:Sale.price"] != "" {
        t.Fatalf("an untagged model and column must stay: %v", hidden)
      }
      if hidden["prisma:Sale.secret"] != tag {
        t.Fatalf("the tagged column must be withdrawn, got %q", hidden["prisma:Sale.secret"])
      }
    })
  }
}
