package evidence

import (
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies a rejection with no reason is still a rejection.
 *
 * The reason is a string from another process and nothing guarantees it is
 * non-empty. If emptiness were what marked an outcome as a failure, a
 * reason-less rejection would materialize zero operations and report nothing —
 * a refused document that reads exactly like an empty document the graph is
 * content with, which is the shape every Swagger source failure report exists
 * to forbid.
 *
 *  1. Remember a rejection carrying no message.
 *  2. Load with an unusable normalizer so the entry is what answers.
 *  3. Assert a diagnostic is still reported and no unit materializes.
 *
 * @evidence contracts/testing.md#behavioral-verification loadSwaggerInventories replays a cache-seeded Rejected outcome with an empty Problem; the assertions require at least one problem, a message naming swagger.json, and zero units for that source.
 * @evidence contracts/testing.md#independent-expectations The seed is an authored Rejected flag with an empty reason; the expectation that it still fails follows from the contract that rejection is a flag, not inferred from message emptiness. The exact fallback sentence is not asserted. A cache miss would yield a normalizer-unavailable message that does not name swagger.json, so the source-name assertion separates replay from fallback.
 * @evidence contracts/testing.md#distinguishing-cases A reason-less rejection is distinguished from an empty successful document by requiring a problem while materializing no units. Replay of a rejection that does carry a reason is covered by TestSwaggerReusesARejectedDocumentWithoutSpawning.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerReportsARejectionThatCarriesNoReason is a selectable native Go unit entry. It seeds the swaggerDocuments cache and calls loadSwaggerInventories over a one-file temp fixture; TTSC_NODE_BINARY names an absent executable so an accidental cache miss cannot spawn Node; the test runs in-process and starts no consumer, Node process, native build or product host.
 */
func TestSwaggerReportsARejectionThatCarriesNoReason(t *testing.T) {
  isolateSwaggerCache(t)
  root := writeInventoryFixture(t, "swagger.json", swaggerCacheDocument)
  swaggerDocuments.store(
    swaggerContentDigest(root, "swagger.json"),
    swaggerDocumentOutcome{Rejected: true},
  )

  t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
  inventories, problems := loadSwaggerInventories(root, swaggerCacheConfig(t, "swagger.json"))
  if len(problems) == 0 {
    t.Fatal("a reason-less rejection must still fail the build")
  }
  if !strings.Contains(strings.Join(problemMessages(problems), "\n"), "swagger.json") {
    t.Fatalf("the diagnostic must name the refused source, got: %v", problems)
  }
  if len(inventories["swagger.json"].Units) != 0 {
    t.Fatal("a refused document must materialize no evidence units")
  }
}
