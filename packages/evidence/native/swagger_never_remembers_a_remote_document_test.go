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
 * @evidence contracts/testing.md#execution-ownership TestSwaggerNeverRemembersARemoteDocument is a selectable native Go unit entry. It calls rememberSwaggerDocument with an HTTPS source and inspects the isolated local swaggerDocuments cache in-process; no consumer, Node process, native build or product host is started.
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
