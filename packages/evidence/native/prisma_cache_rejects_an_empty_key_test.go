package evidence

import (
  "testing"
)

/**
 * Verifies an empty key never enters or leaves the cache.
 *
 * An empty digest is what an unreadable set produces, so admitting one would
 * give every unreadable set the same key — and the first such set's outcome
 * would then answer for every later one.
 *
 *  1. Store an outcome under an empty key.
 *  2. Assert it cannot be looked up.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification prismaCache refuses lookup for a stored empty key.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Empty content identity means unavailable proof under the cache contract.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Unreadable inputs must not share an anonymous entry.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaCacheRejectsAnEmptyKey is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaCacheRejectsAnEmptyKey(t *testing.T) {
  cache := newPrismaCache()
  cache.store("", prismaSetOutcome{Models: []prismaModel{{Name: "Sale"}}})
  if _, hit := cache.lookup(""); hit {
    t.Fatal("an unreadable set must not share one cache entry with every other")
  }
}
