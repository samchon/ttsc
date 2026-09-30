package evidence

import (
  "testing"
)

/**
 * Verifies a remote outcome does not populate the local content-digest cache.
 *
 * A URL has no local digest proof. The preserved assertions inspect the local
 * cache only; successful address-keyed reuse belongs to the remote cache case.
 *
 *  1. Offer a remote outcome with a digest and without one.
 *  2. Inspect the local digest cache.
 *  3. Assert that digest was not stored there.
 *
 * @evidence contracts/testing.md#behavioral-verification rememberSwaggerDocument does not populate the local digest cache for remote source.
 * @evidence contracts/testing.md#independent-expectations Literal HTTPS source and supplied digest cannot establish reusable remote bytes.
 * @evidence contracts/testing.md#distinguishing-cases Assertions inspect swaggerDocuments only; they do not forbid the address-keyed remote cache.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerNeverRemembersARemoteDocument is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestSwaggerNeverRemembersARemoteDocument(t *testing.T) {
  isolateSwaggerCache(t)
  digest := swaggerDigestOf([]byte(swaggerCacheDocument))
  outcome := swaggerDocumentOutcome{
    Operations: []swaggerOperation{{Method: "post", Path: "/members"}},
  }
  rememberSwaggerDocument("https://example.com/swagger.json", digest, outcome)
  rememberSwaggerDocument("https://example.com/swagger.json", "", outcome)
  if _, hit := swaggerDocuments.lookup(digest); hit {
    t.Fatal("a remote document must never be remembered")
  }
}
