package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

const swaggerCacheDocument = `{"openapi":"3.1.0","paths":{"/members":{"post":{}}}}`

// isolateSwaggerCache gives one test its own empty cache and restores the
// shared one afterwards.
//
// The cache outlives a Program cycle on purpose, so without this a test could
// answer from an entry another test stored — and, worse, could silence an
// existing case that proves the normalizer runs. Order dependence between tests
// is exactly the failure a cross-cycle cache invites.
func isolateSwaggerCache(t *testing.T) *swaggerCache {
  t.Helper()
  previous := swaggerDocuments
  swaggerDocuments = newSwaggerCache()
  t.Cleanup(func() { swaggerDocuments = previous })
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

/**
 * Verifies an unchanged document is answered from memory without starting the
 * normalizer.
 *
 * This is the whole point of the cache: a resident host re-runs the graph on
 * every rebuild, and re-normalizing a document nobody touched costs a Node
 * process start — roughly a third of a second, paid the same for a three-
 * operation document as for a two-hundred-operation one.
 *
 * The proof is the unusable binary, as elsewhere in this suite: a spawn that
 * happens fails loudly, so silence is evidence that none was attempted rather
 * than evidence that one succeeded quietly.
 *
 *  1. Remember a document under the bytes on disk.
 *  2. Point `TTSC_NODE_BINARY` at a nonexistent executable and load again.
 *  3. Assert the operations materialize with no problem reported.
 */
func TestSwaggerReusesAnUnchangedDocumentWithoutSpawning(t *testing.T) {
  isolateSwaggerCache(t)
  root := writeInventoryFixture(t, "swagger.json", swaggerCacheDocument)
  warmSwaggerCache(t, root, "swagger.json")

  t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
  inventories, problems := loadSwaggerInventories(root, swaggerCacheConfig(t, "swagger.json"))
  if len(problems) != 0 {
    t.Fatalf("an unchanged document must not start the normalizer, got: %v", problems)
  }
  targets := swaggerTargets(inventories["swagger.json"])
  if len(targets) != 1 || targets[0] != "swagger:swagger.json:POST:/members" {
    t.Fatalf("cached operations must rebuild the same units, got %v", targets)
  }
}

/**
 * Verifies an edited document is not answered from memory.
 *
 * The negative twin of the case above, and the one that matters: a stale
 * inventory is not a slow build, it is a green build that should have failed —
 * a heading or an operation deleted from a source while every citation to it
 * still reports as satisfied.
 *
 *  1. Remember a document, then rewrite the file with different bytes.
 *  2. Point `TTSC_NODE_BINARY` at a nonexistent executable and load again.
 *  3. Assert the normalizer was attempted, proving the entry was not used.
 */
func TestSwaggerDoesNotReuseAnEditedDocument(t *testing.T) {
  isolateSwaggerCache(t)
  root := writeInventoryFixture(t, "swagger.json", swaggerCacheDocument)
  warmSwaggerCache(t, root, "swagger.json")

  rewritten := `{"openapi":"3.1.0","paths":{"/members":{"post":{}},"/orders":{"get":{}}}}`
  if err := os.WriteFile(filepath.Join(root, "swagger.json"), []byte(rewritten), 0o644); err != nil {
    t.Fatal(err)
  }
  t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
  _, problems := loadSwaggerInventories(root, swaggerCacheConfig(t, "swagger.json"))
  if len(problems) == 0 {
    t.Fatal("an edited document must be re-normalized, not answered from memory")
  }
}

/**
 * Verifies a replacement of exactly the same length is not answered from
 * memory.
 *
 * This is the hole a size-and-timestamp key leaves open, and the reason the key
 * is the content itself. An operation renamed to another of equal length, saved
 * inside one filesystem timestamp tick, changes what the document means while
 * changing neither its size nor, on a coarse clock, its modification time.
 *
 *  1. Remember a document, then rewrite it with different bytes of equal length.
 *  2. Point `TTSC_NODE_BINARY` at a nonexistent executable and load again.
 *  3. Assert the normalizer was attempted.
 */
func TestSwaggerDoesNotReuseASameLengthReplacement(t *testing.T) {
  isolateSwaggerCache(t)
  root := writeInventoryFixture(t, "swagger.json", swaggerCacheDocument)
  warmSwaggerCache(t, root, "swagger.json")

  replacement := `{"openapi":"3.1.0","paths":{"/members":{"put!":{}}}}`
  if len(replacement) != len(swaggerCacheDocument) {
    t.Fatalf("fixture must be the same length: %d vs %d", len(replacement), len(swaggerCacheDocument))
  }
  if err := os.WriteFile(filepath.Join(root, "swagger.json"), []byte(replacement), 0o644); err != nil {
    t.Fatal(err)
  }
  t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
  _, problems := loadSwaggerInventories(root, swaggerCacheConfig(t, "swagger.json"))
  if len(problems) == 0 {
    t.Fatal("a same-length replacement must be re-normalized")
  }
}

/**
 * Verifies a deleted document is not answered from memory.
 *
 * A source that vanished has no bytes to hash, so it cannot hit — and it must
 * still reach the normalizer, because the diagnostic a reader needs is the one
 * naming the missing file, not silence.
 *
 *  1. Remember a document, then delete the file.
 *  2. Point `TTSC_NODE_BINARY` at a nonexistent executable and load again.
 *  3. Assert the normalizer was attempted.
 */
func TestSwaggerDoesNotReuseADeletedDocument(t *testing.T) {
  isolateSwaggerCache(t)
  root := writeInventoryFixture(t, "swagger.json", swaggerCacheDocument)
  warmSwaggerCache(t, root, "swagger.json")

  if err := os.Remove(filepath.Join(root, "swagger.json")); err != nil {
    t.Fatal(err)
  }
  t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
  _, problems := loadSwaggerInventories(root, swaggerCacheConfig(t, "swagger.json"))
  if len(problems) == 0 {
    t.Fatal("a deleted document must still reach the normalizer for its diagnostic")
  }
}

/**
 * Verifies two sources holding identical bytes share one entry, each keeping
 * its own unit identity.
 *
 * What is remembered is a property of the document, not of where it was found,
 * so the key is the content alone. Units are rebuilt per source because a unit
 * carries its source in its identity — sharing the entry must not make one
 * source answer under the other's name.
 *
 *  1. Remember one document, then declare a second file with identical bytes.
 *  2. Point `TTSC_NODE_BINARY` at a nonexistent executable and load both.
 *  3. Assert both hit and each unit names its own source.
 */
func TestSwaggerSharesOneEntryAcrossIdenticalDocuments(t *testing.T) {
  isolateSwaggerCache(t)
  root := writeInventoryFixture(t, "first.json", swaggerCacheDocument)
  if err := os.WriteFile(filepath.Join(root, "second.json"), []byte(swaggerCacheDocument), 0o644); err != nil {
    t.Fatal(err)
  }
  warmSwaggerCache(t, root, "first.json")

  t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
  inventories, problems := loadSwaggerInventories(
    root,
    swaggerCacheConfig(t, "first.json", "second.json"),
  )
  if len(problems) != 0 {
    t.Fatalf("identical bytes must share one entry, got: %v", problems)
  }
  for _, source := range []string{"first.json", "second.json"} {
    targets := swaggerTargets(inventories[source])
    want := "swagger:" + source + ":POST:/members"
    if len(targets) != 1 || targets[0] != want {
      t.Fatalf("source %q must keep its own identity, got %v", source, targets)
    }
  }
}

/**
 * Verifies a remote document never answers from memory.
 *
 * A URL has no validator without a fetch, and the fetch is most of what the
 * normalizer costs — so a remote source cannot be shown unchanged without
 * paying the price of finding out. Excluding it is what keeps the cache honest
 * rather than merely fast.
 *
 * This pins the behavior, not the branch that produces it. Deleting the remote
 * check alone leaves this case passing, because a URL-shaped path fails to read
 * and yields no key either way; the explicit check is the reason rather than
 * the accident, and `isRemoteSwaggerSource` is pinned separately below.
 *
 *  1. Store an entry under the digest of a local file with the same content.
 *  2. Declare an HTTP source and point the bridge at an unusable binary.
 *  3. Assert the normalizer was attempted.
 */
func TestSwaggerNeverReusesARemoteDocument(t *testing.T) {
  isolateSwaggerCache(t)
  root := writeInventoryFixture(t, "swagger.json", swaggerCacheDocument)
  warmSwaggerCache(t, root, "swagger.json")

  if digest := swaggerContentDigest(root, "https://example.com/swagger.json"); digest != "" {
    t.Fatalf("a remote source must not hash to a cache key, got %q", digest)
  }
  t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
  _, problems := loadSwaggerInventories(
    root,
    swaggerCacheConfig(t, "https://example.com/swagger.json"),
  )
  if len(problems) == 0 {
    t.Fatal("a remote source must always be fetched, never answered from memory")
  }
}

/**
 * Verifies which sources are classified as remote.
 *
 * The loader's own case above cannot isolate this, so the classifier is pinned
 * directly. Scheme matching is case-insensitive because a configuration is
 * hand-written, and a path merely containing the text is local — the graph's
 * own configuration decoder already refuses anything ambiguous, so this only
 * has to agree with it.
 *
 *  1. Classify http and https sources in mixed case.
 *  2. Classify local paths, including one that merely mentions a scheme.
 *  3. Assert only the true URLs are remote.
 */
func TestSwaggerClassifiesRemoteSources(t *testing.T) {
  for _, source := range []string{
    "http://example.com/swagger.json",
    "https://example.com/swagger.json",
    "HTTPS://EXAMPLE.COM/swagger.json",
  } {
    if !isRemoteSwaggerSource(source) {
      t.Fatalf("%q must be remote", source)
    }
  }
  for _, source := range []string{
    "swagger.json",
    "docs/https-swagger.json",
    "packages/api/openapi.yaml",
  } {
    if isRemoteSwaggerSource(source) {
      t.Fatalf("%q must be local", source)
    }
  }
}

/**
 * Verifies a mixed graph re-normalizes only what changed.
 *
 * One spawn serves every source in a cycle, so a single miss pays the process
 * start for all of them unless the request is narrowed. Sending only the misses
 * is what keeps one edited document from costing the others their entries.
 *
 *  1. Remember two documents, then edit one of them.
 *  2. Point `TTSC_NODE_BINARY` at a nonexistent executable and load both.
 *  3. Assert only the edited source is reported.
 */
func TestSwaggerRenormalizesOnlyTheChangedSource(t *testing.T) {
  isolateSwaggerCache(t)
  root := writeInventoryFixture(t, "stable.json", swaggerCacheDocument)
  if err := os.WriteFile(filepath.Join(root, "volatile.json"), []byte(swaggerCacheDocument), 0o644); err != nil {
    t.Fatal(err)
  }
  warmSwaggerCache(t, root, "stable.json")

  edited := `{"openapi":"3.1.0","paths":{"/orders":{"get":{}}}}`
  if err := os.WriteFile(filepath.Join(root, "volatile.json"), []byte(edited), 0o644); err != nil {
    t.Fatal(err)
  }
  t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
  inventories, problems := loadSwaggerInventories(
    root,
    swaggerCacheConfig(t, "stable.json", "volatile.json"),
  )
  if len(problems) == 0 {
    t.Fatal("the edited source must be re-normalized")
  }
  for _, problem := range problems {
    if strings.Contains(problem.Message, "stable.json") {
      t.Fatalf("the unchanged source must not be re-normalized, got: %v", problems)
    }
  }
  if len(inventories["stable.json"].Units) != 1 {
    t.Fatalf("the unchanged source must keep its units, got %d", len(inventories["stable.json"].Units))
  }
}

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

/**
 * Verifies a rejected document is answered from memory without a second spawn.
 *
 * A document the normalizer refuses is one the author is midway through fixing,
 * and while they fix it every unrelated TypeScript save would otherwise pay a
 * fresh process start to be told the same thing again — the state where the
 * cache is least allowed to give up, because it is where the edit loop is
 * tightest.
 *
 *  1. Remember a rejection under the bytes on disk.
 *  2. Point `TTSC_NODE_BINARY` at a nonexistent executable and load again.
 *  3. Assert the original diagnostic is reported, not a normalizer failure.
 */
func TestSwaggerReusesARejectedDocumentWithoutSpawning(t *testing.T) {
  isolateSwaggerCache(t)
  root := writeInventoryFixture(t, "swagger.json", swaggerCacheDocument)
  swaggerDocuments.store(
    swaggerContentDigest(root, "swagger.json"),
    swaggerDocumentOutcome{Rejected: true, Problem: "unsupported OpenAPI version"},
  )

  t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
  inventories, problems := loadSwaggerInventories(root, swaggerCacheConfig(t, "swagger.json"))
  joined := strings.Join(problemMessages(problems), "\n")
  if !strings.Contains(joined, "unsupported OpenAPI version") {
    t.Fatalf("the remembered rejection must be reported verbatim, got: %v", problems)
  }
  if strings.Contains(joined, "could not run its Swagger normalizer") {
    t.Fatalf("a remembered rejection must not start the normalizer, got: %v", problems)
  }
  if len(inventories["swagger.json"].Units) != 0 {
    t.Fatal("a rejected document must materialize no evidence units")
  }
}

/**
 * Verifies a remembered rejection is dropped the moment the document is fixed.
 *
 * The negative twin of the case above, and the one that decides whether caching
 * failures is safe at all. A rejection kept past its bytes would leave an author
 * staring at a diagnostic for a document they have already repaired, with
 * nothing but a restart to clear it — worse than the spawn it saved.
 *
 *  1. Remember a rejection under the bytes on disk.
 *  2. Rewrite the document and load with an unusable normalizer.
 *  3. Assert the normalizer was attempted rather than the rejection replayed.
 */
func TestSwaggerForgetsARejectedDocumentOnceItIsFixed(t *testing.T) {
  isolateSwaggerCache(t)
  root := writeInventoryFixture(t, "swagger.json", swaggerCacheDocument)
  swaggerDocuments.store(
    swaggerContentDigest(root, "swagger.json"),
    swaggerDocumentOutcome{Rejected: true, Problem: "unsupported OpenAPI version"},
  )

  repaired := `{"openapi":"3.1.0","paths":{"/members":{"post":{}},"/orders":{"get":{}}}}`
  if err := os.WriteFile(filepath.Join(root, "swagger.json"), []byte(repaired), 0o644); err != nil {
    t.Fatal(err)
  }
  t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
  _, problems := loadSwaggerInventories(root, swaggerCacheConfig(t, "swagger.json"))
  joined := strings.Join(problemMessages(problems), "\n")
  if strings.Contains(joined, "unsupported OpenAPI version") {
    t.Fatalf("a repaired document must not replay its rejection, got: %v", problems)
  }
  if !strings.Contains(joined, "could not run its Swagger normalizer") {
    t.Fatalf("a repaired document must be re-normalized, got: %v", problems)
  }
}

/**
 * Verifies a rejection with no reason is still a rejection.
 *
 * The reason is a string from another process and nothing guarantees it is
 * non-empty. If emptiness were what marked an outcome as a failure, a
 * reason-less rejection would materialize zero operations and report nothing —
 * a refused document that reads exactly like an empty document the graph is
 * content with, which is the shape `test_evidence_graph_reports_swagger_source_failures`
 * exists to forbid.
 *
 *  1. Remember a rejection carrying no message.
 *  2. Load with an unusable normalizer so the entry is what answers.
 *  3. Assert a diagnostic is still reported and no unit materializes.
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

/**
 * Verifies a remote document is never remembered, whatever it reports.
 *
 * A URL cannot be revalidated without fetching it, so an entry for one could
 * only ever be a guess that the served document has not changed. The normalizer
 * withholds a digest for a URL, and this refuses one independently — two
 * defenses because a single missing check here would be invisible: the cache
 * would answer, the answer would usually be right, and the day it was wrong
 * nothing would say so.
 *
 *  1. Offer an outcome for an HTTP source, once with a digest and once without.
 *  2. Look both up.
 *  3. Assert neither was remembered.
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

/**
 * Verifies a URL is fetched once per process and then answered from memory.
 *
 * A remote document has no key without fetching it, so it cannot be revalidated
 * the way a local file is: the choice is fetch once or fetch forever. A
 * resident session that refetched on every rebuild would put a network round
 * trip on the edit loop and make an editor depend on connectivity to report
 * anything at all.
 *
 *  1. Remember a URL's operations.
 *  2. Look the same URL up again.
 *  3. Assert the second answer comes from memory rather than another fetch.
 */
func TestSwaggerRemoteDocumentIsFetchedOncePerProcess(t *testing.T) {
  source := "https://example.com/openapi.json"
  swaggerRemoteDocuments = newSwaggerCache()
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

/**
 * Verifies a refused URL is not remembered.
 *
 * This is the asymmetry that makes remembering a URL survivable at all. A local
 * rejection is keyed by the bytes that caused it, so repairing the document
 * changes the key and clears the entry. A URL is keyed by its address, and
 * nothing an author can do changes that — so one refused connection would
 * poison the URL for the whole session, with no edit able to invalidate it and
 * a restart the only way out.
 *
 *  1. Remember a rejected URL outcome.
 *  2. Look the same URL up.
 *  3. Assert nothing was remembered, so the next cycle tries again.
 */
func TestSwaggerRefusedRemoteDocumentIsNotRemembered(t *testing.T) {
  source := "https://example.com/openapi.json"
  swaggerRemoteDocuments = newSwaggerCache()
  rememberSwaggerDocument(source, "", swaggerDocumentOutcome{
    Rejected: true,
    Problem:  "connection refused",
  })
  if _, hit := lookupSwaggerDocument(source, ""); hit {
    t.Fatal("a transient failure must not outlive the evaluation that saw it")
  }
}

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
