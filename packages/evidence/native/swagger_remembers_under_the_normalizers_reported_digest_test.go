package evidence

import (
  "testing"
)

/**
 * Verifies an entry is keyed on the digest the normalizer reported, not on one
 * taken here.
 *
 * The normalizer opens the file again, in its own process, after this one read
 * it. Keying on the earlier digest would let a write landing inside that window
 * bind one document's operations to another document's bytes — and unlike a
 * miss, that entry answers every later cycle with the wrong document. Keying on
 * the reported digest makes the pairing exact by construction.
 *
 * The two digests are deliberately different here, which is the whole point: a
 * lookup by what is on disk now must miss, and a lookup by what the normalizer
 * actually read must hit.
 *
 *  1. Remember an outcome under a digest that is not the file's.
 *  2. Look the entry up both ways.
 *  3. Assert only the reported digest finds it.
 *
 * @evidence contracts/testing.md#behavioral-verification rememberSwaggerDocument misses on-disk digest and hits only the supplied reported digest.
 * @evidence contracts/testing.md#independent-expectations Two explicit fixture payloads establish different keys; no real normalizer supplies either expectation here.
 * @evidence contracts/testing.md#distinguishing-cases Producer-read identity differs from caller-read identity through the supplied-digest seam.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerRemembersUnderTheNormalizersReportedDigest is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestSwaggerRemembersUnderTheNormalizersReportedDigest(t *testing.T) {
  isolateSwaggerCache(t)
  root := writeInventoryFixture(t, "swagger.json", swaggerCacheDocument)
  reported := swaggerDigestOf([]byte(`{"openapi":"3.1.0","paths":{"/orders":{"get":{}}}}`))
  onDisk := swaggerContentDigest(root, "swagger.json")
  if reported == onDisk {
    t.Fatal("the fixture must use two distinct digests to mean anything")
  }

  rememberSwaggerDocument("swagger.json", reported, swaggerDocumentOutcome{
    Operations: []swaggerOperation{{Method: "get", Path: "/orders"}},
  })
  if _, hit := swaggerDocuments.lookup(onDisk); hit {
    t.Fatal("the entry must not answer to the bytes this process read")
  }
  if _, hit := swaggerDocuments.lookup(reported); !hit {
    t.Fatal("the entry must answer to the bytes the normalizer read")
  }
}
