package evidence

import (
  "testing"
)

/**
 * Verifies a rejection is remembered as a rejection.
 *
 * A schema the parser refuses is one its author is midway through fixing, and
 * every unrelated save during that repair would otherwise pay a fresh process
 * start to be told the same thing. The danger is the opposite mistake: an
 * outcome remembered as an empty success would report a schema with no models,
 * whose every obligation is vacuously satisfied.
 *
 *  1. Store a rejected outcome.
 *  2. Read it back.
 *  3. Assert it is still a rejection carrying its reason.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification prismaCache store/lookup preserves rejection,reason and empty models.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Literal rejected outcome fixes the expected payload.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Rejected state remains distinct from successful empty schemas.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaCacheRemembersARejection is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaCacheRemembersARejection(t *testing.T) {
  cache := newPrismaCache()
  cache.store("digest", prismaSetOutcome{
    Rejected: true,
    Problem:  "Error validating: ...",
  })
  outcome, hit := cache.lookup("digest")
  if !hit {
    t.Fatal("a stored outcome must be readable")
  }
  if !outcome.Rejected || outcome.Problem == "" {
    t.Fatalf("a rejection must survive the round trip: %+v", outcome)
  }
  if len(outcome.Models) != 0 {
    t.Fatal("a rejected set has no models")
  }
}
