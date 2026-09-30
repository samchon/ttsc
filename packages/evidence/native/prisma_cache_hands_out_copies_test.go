package evidence

import (
  "testing"
)

/**
 * Verifies a cached entry cannot be mutated through a later reader.
 *
 * Every reader builds units from the models it gets back, and a resident host
 * may hold several projects at once. Handing out the stored slice would let one
 * cycle's edits reach another cycle's answer, which is a corruption no
 * diagnostic could ever attribute to a cache.
 *
 *  1. Store an outcome and read it twice.
 *  2. Mutate the first copy's models and fields.
 *  3. Assert the second copy is untouched.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification prismaCache lookup mutations of nested model/field values do not alter a later lookup.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Original literal Sale/price values establish retained state.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Both model and nested field data must be detached from readers.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaCacheHandsOutCopies is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaCacheHandsOutCopies(t *testing.T) {
  cache := newPrismaCache()
  cache.store("digest", prismaSetOutcome{
    Models: []prismaModel{{
      Name:   "Sale",
      Fields: []prismaField{{Name: "price", Symbol: "column"}},
    }},
  })
  first, _ := cache.lookup("digest")
  first.Models[0].Name = "Mutated"
  first.Models[0].Fields[0].Name = "mutated"
  second, _ := cache.lookup("digest")
  if second.Models[0].Name != "Sale" || second.Models[0].Fields[0].Name != "price" {
    t.Fatalf("a reader mutated the stored entry: %+v", second.Models[0])
  }
}
