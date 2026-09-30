package evidence

import (
  "testing"
)

/**
 * Verifies another tool's tag ends a citation instead of being swallowed into
 * its reason.
 *
 * A Prisma doc comment is shared ground: `prisma-markdown` reads `@namespace`
 * and `@erd`, and the prior art this product generalizes writes `@stance` and
 * `@hidden` beside its citations. Without a tag boundary the first of those
 * becomes part of the reason above it, so the reason a reviewer reads is not
 * the reason the author wrote — and nothing anywhere reports it.
 *
 *  1. Write a citation followed by two unrelated tags.
 *  2. Assert the reason stops at the first of them.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification prismaDeclarations keeps one citation and the exact reason before a neighboring tag.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Literal expected reason ends before the unrelated annotation.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Continuation prose belongs to evidence while another tag ends it.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaCitationStopsAtAnotherTag is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaCitationStopsAtAnotherTag(t *testing.T) {
  declarations, problems := prismaClaimOf(`/// A sale.
/// @evidence docs/spec.md#pricing The sale price derives from this section.
/// @stance material
/// @hidden
model Sale {
  price Int
  seller Seller
}
`, prismaClaimModels)
  if len(problems) != 0 {
    t.Fatalf("unrelated tags are not this rule's business: %v", problems)
  }
  if len(declarations) != 1 {
    t.Fatalf("expected one citation, got %d", len(declarations))
  }
  if declarations[0].Reason != "The sale price derives from this section." {
    t.Fatalf("reason swallowed a neighbouring tag: %q", declarations[0].Reason)
  }
}
