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
 * @evidence contracts/testing.md#behavioral-verification prismaModelUnits is called for every tag in hiddenTagCases (@internal, @hidden, @ignore) on a hand-built model whose documentation carries the tag, and on a model whose single column documentation carries it; the test asserts each unit's Hidden marker equals the tag.
 * @evidence contracts/testing.md#independent-expectations Models and tags are authored literals, and the expected markers follow from the contract that a hiding tag withdraws its declaration and a withdrawn model withdraws its members, the same as the TypeScript tag semantics; the expected value is the literal tag, not a recomputed result.
 * @evidence contracts/testing.md#distinguishing-cases The tagged model withdraws the model unit and both its column and relation members; in the second model the untagged model and untagged column keep an empty marker while only the tagged column is withdrawn. Tags mentioned only in prose, or placed after other text, are not exercised here.
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
