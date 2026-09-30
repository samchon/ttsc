package evidence

import (
  "testing"
)

/**
 * Verifies a lookup hands back a copy.
 *
 * A caller builds units from the returned slice while another Program cycle may
 * be reading the same entry. Returning the stored slice would let one cycle's
 * caller corrupt what every later cycle answers with, which no test of the
 * loader itself would notice.
 *
 *  1. Store one operation and read it back.
 *  2. Overwrite the returned slice.
 *  3. Assert a second lookup is unaffected.
 *
 * @evidence contracts/testing.md#behavioral-verification swaggerCache lookup mutation does not change later operation reads.
 * @evidence contracts/testing.md#independent-expectations Original literal post/members fields fix resident payload.
 * @evidence contracts/testing.md#distinguishing-cases Returned slice must be detached from the cache.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerCacheLookupReturnsACopy is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestSwaggerCacheLookupReturnsACopy(t *testing.T) {
  cache := isolateSwaggerCache(t)
  cache.store("digest", swaggerDocumentOutcome{
    Operations: []swaggerOperation{{Method: "post", Path: "/members"}},
  })

  first, hit := cache.lookup("digest")
  if !hit {
    t.Fatal("the stored entry must be found")
  }
  first.Operations[0] = swaggerOperation{Method: "delete", Path: "/wrong"}

  second, hit := cache.lookup("digest")
  if !hit {
    t.Fatal("the stored entry must still be found")
  }
  if second.Operations[0].Method != "post" ||
    second.Operations[0].Path != "/members" {
    t.Fatalf("a caller must not be able to corrupt the entry, got %+v", second.Operations[0])
  }
}
