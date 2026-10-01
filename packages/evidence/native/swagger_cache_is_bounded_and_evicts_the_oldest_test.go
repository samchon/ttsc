package evidence

import (
  "testing"
)

/**
 * Verifies the cache is bounded and drops its oldest entry first.
 *
 * A resident host lives for days, and a configuration that rewrites a document
 * under a new digest every cycle would otherwise grow this map without end.
 * Dropping the oldest rather than clearing keeps a project sitting exactly on
 * the limit still hitting.
 *
 *  1. Store one more document than the limit allows.
 *  2. Assert the first is gone and the last is present.
 *  3. Assert the map never exceeds the limit.
 *
 * @evidence contracts/testing.md#behavioral-verification swaggerCache evicts digest0,retains newest and stays within swaggerCacheLimit.
 * @evidence contracts/testing.md#independent-expectations Ordered inserted keys and capacity limit establish retention expectations.
 * @evidence contracts/testing.md#distinguishing-cases Crossing capacity releases the oldest retained payload.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerCacheIsBoundedAndEvictsTheOldest is a selectable native Go unit entry. It stores swaggerCacheLimit+1 entries into an isolated swaggerCache and looks them up in-process; no consumer, Node process, native build or product host is started.
 */
func TestSwaggerCacheIsBoundedAndEvictsTheOldest(t *testing.T) {
  cache := isolateSwaggerCache(t)
  for index := 0; index <= swaggerCacheLimit; index++ {
    cache.store(
      "digest-"+decimal(index),
      swaggerDocumentOutcome{
        Operations: []swaggerOperation{{Method: "get", Path: "/" + decimal(index)}},
      },
    )
  }
  if _, hit := cache.lookup("digest-0"); hit {
    t.Fatal("the oldest entry must be evicted once the limit is passed")
  }
  if _, hit := cache.lookup("digest-" + decimal(swaggerCacheLimit)); !hit {
    t.Fatal("the newest entry must be kept")
  }
  if len(cache.entries) > swaggerCacheLimit {
    t.Fatalf("the cache must stay bounded, got %d entries", len(cache.entries))
  }
}
