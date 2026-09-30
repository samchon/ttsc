package evidence

import (
  "strings"
  "testing"
)

const swaggerCacheDocument = `{"openapi":"3.1.0","paths":{"/members":{"post":{}}}}`

// isolateSwaggerCache gives one test empty local and remote caches and restores the
// shared one afterwards.
//
// The cache outlives a Program cycle on purpose, so without this a test could
// answer from an entry another test stored — and, worse, could silence an
// existing case that proves the normalizer runs. Order dependence between tests
// is exactly the failure a cross-cycle cache invites.
func isolateSwaggerCache(t *testing.T) *swaggerCache {
  t.Helper()
  previous := swaggerDocuments
  previousRemote := swaggerRemoteDocuments
  swaggerDocuments = newSwaggerCache()
  swaggerRemoteDocuments = newSwaggerCache()
  t.Cleanup(func() {
    swaggerDocuments = previous
    swaggerRemoteDocuments = previousRemote
  })
  return swaggerDocuments
}

// warmSwaggerCache remembers one document's operations under the bytes
// currently on disk, without running the normalizer.
func warmSwaggerCache(t *testing.T, root string, source string) {
  t.Helper()
  digest := swaggerContentDigest(root, source)
  if digest == "" {
    t.Fatalf("fixture source %q must hash", source)
  }
  swaggerDocuments.store(digest, swaggerDocumentOutcome{
    Operations: []swaggerOperation{{Method: "post", Path: "/members"}},
  })
}

func swaggerCacheConfig(t *testing.T, sources ...string) graphConfig {
  t.Helper()
  references := make([]string, 0, len(sources))
  for _, source := range sources {
    references = append(
      references,
      `{"type":"swagger","file":"`+source+`"}`,
    )
  }
  // A Swagger reference owns an exact path rather than a population base, so
  // the root this anchors against is irrelevant to what these cases assert.
  return decodeInventoryConfig(t, "", `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":[`+strings.Join(references, ",")+`]
  }]}`)
}

func swaggerTargets(inventory *artifactInventory) []string {
  targets := []string{}
  for _, unit := range inventory.Units {
    targets = append(targets, unit.ID)
  }
  return targets
}
