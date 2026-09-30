package evidence

import (
  "testing"
)

/**
 * Verifies a local document still keys on its content rather than its path.
 *
 * The negative twin of the two cases above, and the reason they are separate
 * caches. A local entry means "these bytes normalize to this", which stays true
 * forever; keying it by path would make an edited file answer with its previous
 * meaning, which is the one thing a cache may never do.
 *
 *  1. Remember a local document under its content digest.
 *  2. Look it up by its path.
 *  3. Assert the path is not a key, and the digest is.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification lookupSwaggerDocument misses local path without digest and hits it with digest.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Literal source and digest keys establish local identity separately.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Local content-keyed lookup remains distinct from remote address-keyed lookup.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSwaggerLocalDocumentStillKeysOnContent is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestSwaggerLocalDocumentStillKeysOnContent(t *testing.T) {
  swaggerDocuments = newSwaggerCache()
  swaggerRemoteDocuments = newSwaggerCache()
  rememberSwaggerDocument("api/openapi.json", "digest", swaggerDocumentOutcome{
    Operations: []swaggerOperation{{Method: "GET", Path: "/members"}},
  })
  if _, hit := lookupSwaggerDocument("api/openapi.json", ""); hit {
    t.Fatal("a local document must not be answered without its content key")
  }
  if _, hit := lookupSwaggerDocument("api/openapi.json", "digest"); !hit {
    t.Fatal("a local document must be answered from its content key")
  }
}
