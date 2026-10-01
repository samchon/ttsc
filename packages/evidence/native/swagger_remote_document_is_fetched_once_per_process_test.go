package evidence

import (
  "testing"
)

/**
 * Verifies a remembered successful URL outcome is returned from the address cache.
 *
 * This direct cache test supplies the outcome itself; it performs no network
 * fetch and does not measure a real normalizer process lifetime.
 *
 *  1. Store a successful URL outcome.
 *  2. Look up the same address.
 *  3. Assert the remembered operation survives.
 *
 * @evidence contracts/testing.md#behavioral-verification rememberSwaggerDocument/lookupSwaggerDocument return the seeded remote operation from address cache.
 * @evidence contracts/testing.md#independent-expectations Explicit POST/members outcome establishes expected remembered state.
 * @evidence contracts/testing.md#distinguishing-cases No network fetch or Node child runs here, so the test does not count actual fetches.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerRemoteDocumentIsFetchedOncePerProcess is a selectable native Go unit entry. It calls rememberSwaggerDocument and lookupSwaggerDocument against isolated in-memory caches; it performs no fetch; the test runs in-process and starts no consumer, Node process, native build or product host.
 */
func TestSwaggerRemoteDocumentIsFetchedOncePerProcess(t *testing.T) {
  source := "https://example.com/openapi.json"
  isolateSwaggerCache(t)
  rememberSwaggerDocument(source, "", swaggerDocumentOutcome{
    Operations: []swaggerOperation{{Method: "POST", Path: "/members"}},
  })
  outcome, hit := lookupSwaggerDocument(source, "")
  if !hit {
    t.Fatal("a URL answered once must be answered from memory afterwards")
  }
  if len(outcome.Operations) != 1 || outcome.Operations[0].Path != "/members" {
    t.Fatalf("the remembered document must survive intact: %+v", outcome)
  }
}
