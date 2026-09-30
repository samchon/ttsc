package evidence

import (
  "testing"
)

/**
 * Verifies an asterisk in ordinary prose is not mistaken for a buried citation.
 *
 * The negative twin of the case above, and the reason the detector strips only
 * *leading* punctuation. A bulleted doc comment is ordinary documentation, and
 * reporting it would teach an author to stop reading these diagnostics — which
 * costs more than the case being caught.
 *
 *  1. Write a bulleted list and a mid-sentence mention in a doc comment.
 *  2. Assert nothing is reported.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification prismaDeclarationsFromComments reports no buried-tag problem for bulleted prose.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Authored bullets have asterisks as text rather than evidence declarations.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Asterisks alone must not trigger malformed-evidence rules.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaAsteriskProseIsNotBuried is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaAsteriskProseIsNotBuried(t *testing.T) {
  _, problems := prismaClaimOf(`/// Notes:
/// * write @evidence above the model it grounds
/// * keep the reason reviewable
model Sale {
  price Int
  seller Seller
}
`, prismaClaimModels)
  if len(problems) != 0 {
    t.Fatalf("a bulleted note is not a buried citation: %v", problems)
  }
}
