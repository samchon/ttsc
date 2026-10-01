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
 * @evidence contracts/testing.md#behavioral-verification lookupSwaggerDocument misses local path without digest and hits it with digest.
 * @evidence contracts/testing.md#independent-expectations Literal source and digest keys establish local identity separately.
 * @evidence contracts/testing.md#distinguishing-cases A local entry remembered under a content digest misses when looked up with an empty digest and hits when looked up with that digest, so path alone is not a key. No remote source is looked up here.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerLocalDocumentStillKeysOnContent is a selectable native Go unit entry. It calls rememberSwaggerDocument and lookupSwaggerDocument against isolated in-memory caches in-process; no consumer, Node process, native build or product host is started.
 */
func TestSwaggerLocalDocumentStillKeysOnContent(t *testing.T) {
  isolateSwaggerCache(t)
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
