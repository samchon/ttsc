package evidence

import (
  "testing"
)

/**
 * Verifies prose that merely mentions the tag is not mistaken for a buried
 * citation.
 *
 * The negative twin of the case above, and the reason its detection strips only
 * *leading* slashes. A comment explaining the convention, or a sentence with a
 * tag name in the middle of it, is ordinary documentation — reporting it would
 * teach an author to stop reading these diagnostics, which costs more than the
 * case being caught.
 *
 *  1. Mention the tag inside a sentence and after a non-slash prefix.
 *  2. Assert nothing is reported.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification prismaDeclarationsFromComments reports no buried-tag diagnostic for prose mentioning syntax.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The fixture contains prose rather than a declaration-starting evidence tag.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Mentioning a tag differs from malformed annotation placement.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaProseMentioningATagIsNotBuried is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaProseMentioningATagIsNotBuried(t *testing.T) {
  _, problems := prismaClaimOf(`/// Write @evidence above the model it grounds.
/// - @evidence is the tag this schema uses.
model Sale {
  price Int
  seller Seller
}
`, prismaClaimModels)
  if len(problems) != 0 {
    t.Fatalf("prose naming the tag is not a buried citation: %v", problems)
  }
}
