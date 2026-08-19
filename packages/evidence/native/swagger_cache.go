package evidence

import (
  "crypto/sha256"
  "encoding/hex"
  "os"
  "strings"
  "sync"
)

// swaggerCacheLimit bounds the cache so a resident host cannot grow without
// end. A project configures a handful of Swagger documents, not hundreds, so
// this is a backstop against a pathological configuration rather than a tuning
// knob — and the oldest entry is dropped rather than the whole map cleared, so
// a project sitting exactly on the limit still gets hits.
const swaggerCacheLimit = 64

// swaggerDocuments remembers normalization outcomes by document content.
//
// This is the rule's own state, not the project state the host publishes. The
// `@ttsc/lint` contributor contract forbids caching a `SetState` value across Program
// cycles because the host owns that wrapper's lifetime; nothing there governs
// memory a rule keeps for itself, and the parallel walk never reaches this
// because a project rule runs before any file rule. The mutex is not for that
// walk — it is because a resident host may hold several projects at once, and
// paying for a lock on a path that skips a process spawn is not a trade worth
// thinking about.
//
// The entry lives as long as the process does. Both hosts that reuse it are
// line-protocol loops in one process, so exit disposes it; the contributor API
// exposes no earlier disposal hook, which is why the bound above exists rather
// than being a tuning knob.
var swaggerDocuments = newSwaggerCache()

// swaggerRemoteDocuments remembers a URL's operations for the process lifetime,
// keyed by the address rather than by content.
//
// A remote document has no key without fetching it, so it cannot be revalidated
// the way a local file is. The choice is therefore not "cache or revalidate" but
// "fetch once or fetch forever", and a resident session that refetched on every
// rebuild would put a network round trip on the edit loop — and make an editor
// depend on connectivity to report anything at all.
//
// The freshness this gives up is real and bounded by the process: a served
// document that changes mid-session is not seen until the session restarts. A
// one-shot `ttsc check` is a fresh process, so it always fetches.
//
// **A rejection is never remembered here.** The key is the address, so nothing
// an author can do would clear it — one refused connection would poison the URL
// for the whole session with no edit able to invalidate the entry. Failure stays
// per-evaluation, which is also what makes a transient outage recoverable
// without restarting the editor.
var swaggerRemoteDocuments = newSwaggerCache()

// swaggerDocumentOutcome is what one document's bytes normalized to.
//
// Failure is remembered as deliberately as success. A document the normalizer
// rejects is one the author is midway through fixing, and while they fix it
// every unrelated TypeScript save would otherwise pay a fresh process start to
// be told the same thing again. Nothing is cached forever: repairing the
// document changes its bytes, which changes the key, which misses.
//
// Rejected is a separate flag rather than a non-empty Problem, because the
// reason is the normalizer's string and this rule does not get to assume it is
// non-empty. Inferring rejection from the message would turn a reason-less
// failure into zero operations and no diagnostic — a rejected document that
// reads exactly like an empty but passing one, which is the shape
// `test_evidence_graph_reports_swagger_source_failures` exists to forbid.
type swaggerDocumentOutcome struct {
  Operations []swaggerOperation
  Rejected   bool
  Problem    string
}

func newSwaggerCache() *swaggerCache {
  return &swaggerCache{entries: map[string]swaggerDocumentOutcome{}}
}

type swaggerCache struct {
  mutex   sync.Mutex
  entries map[string]swaggerDocumentOutcome
  order   []string
}

func (cache *swaggerCache) lookup(digest string) (swaggerDocumentOutcome, bool) {
  if digest == "" {
    return swaggerDocumentOutcome{}, false
  }
  cache.mutex.Lock()
  defer cache.mutex.Unlock()
  outcome, hit := cache.entries[digest]
  if !hit {
    return swaggerDocumentOutcome{}, false
  }
  // Copied out because the caller builds units from it while another cycle
  // may be reading the same entry.
  return swaggerDocumentOutcome{
    Operations: append([]swaggerOperation(nil), outcome.Operations...),
    Rejected:   outcome.Rejected,
    Problem:    outcome.Problem,
  }, true
}

func (cache *swaggerCache) store(digest string, outcome swaggerDocumentOutcome) {
  if digest == "" {
    return
  }
  cache.mutex.Lock()
  defer cache.mutex.Unlock()
  if _, exists := cache.entries[digest]; exists {
    return
  }
  if len(cache.order) >= swaggerCacheLimit {
    delete(cache.entries, cache.order[0])
    cache.order = cache.order[1:]
  }
  cache.entries[digest] = swaggerDocumentOutcome{
    Operations: append([]swaggerOperation(nil), outcome.Operations...),
    Rejected:   outcome.Rejected,
    Problem:    outcome.Problem,
  }
  cache.order = append(cache.order, digest)
}

// swaggerContentDigests hashes each local source's bytes.
//
// The digest is the whole cache key, which is what makes staleness structural
// rather than improbable: identical bytes normalize to identical operations, so
// a hit can only return what the current file means. An edit, a truncation, or
// a same-length replacement all change the digest and miss. A missing or
// unreadable file yields no digest and is normalized as before, which keeps the
// normalizer's own diagnostic for it.
//
// An HTTP(S) source never participates. A URL has no validator without a
// fetch, and the fetch is most of what the normalizer costs, so a remote
// document cannot be shown unchanged without paying the price of finding out.
func swaggerContentDigests(root string, sources []string) map[string]string {
  digests := map[string]string{}
  for _, source := range sources {
    digest := swaggerContentDigest(root, source)
    if digest != "" {
      digests[source] = digest
    }
  }
  return digests
}

func swaggerContentDigest(root string, source string) string {
  if isRemoteSwaggerSource(source) {
    return ""
  }
  content, err := os.ReadFile(swaggerSourcePath(root, source))
  if err != nil {
    return ""
  }
  return swaggerDigestOf(content)
}

func swaggerDigestOf(content []byte) string {
  sum := sha256.Sum256(content)
  return hex.EncodeToString(sum[:])
}

// swaggerSourcePath locates a local document, which may sit outside the project.
func swaggerSourcePath(root string, source string) string {
  return resolveProjectPath(root, source)
}

// rememberSwaggerDocument records an outcome under the bytes it was produced
// from, as reported by the process that produced it.
//
// The digest is the normalizer's own, never the one this process took
// beforehand. The normalizer opens the file again, in another process, after
// this one read it — so keying on the earlier digest would let a write landing
// inside that window bind one document's operations to another document's
// bytes. That is a hit which answers with the wrong document and keeps doing
// so, which is the one failure a cache must not be able to produce.
//
// A source is skipped when the normalizer reports no digest, which is how a
// remote document stays out of the cache no matter what it returns.
func rememberSwaggerDocument(
  source string,
  digest string,
  outcome swaggerDocumentOutcome,
) {
  if isRemoteSwaggerSource(source) {
    if !outcome.Rejected {
      swaggerRemoteDocuments.store(source, outcome)
    }
    return
  }
  if digest == "" {
    return
  }
  swaggerDocuments.store(digest, outcome)
}

// lookupSwaggerDocument answers from whichever memory owns this source.
//
// The two are separate caches rather than one map with two key shapes, because
// they answer different questions: a local entry means "these bytes normalize
// to this", which stays true forever, while a remote entry means "this address
// answered this, once", which is a decision about freshness rather than a fact
// about content.
func lookupSwaggerDocument(
  source string,
  digest string,
) (swaggerDocumentOutcome, bool) {
  if isRemoteSwaggerSource(source) {
    return swaggerRemoteDocuments.lookup(source)
  }
  return swaggerDocuments.lookup(digest)
}

// swaggerUnitsFromOutcome rebuilds one source's units from a remembered
// outcome.
//
// Units are rebuilt per source rather than remembered, because a unit carries
// its source in its identity while the operations do not. That is also what
// lets two sources holding identical bytes share one entry: what was cached is
// a property of the document, not of where it was found.
func swaggerUnitsFromOutcome(
  source string,
  inventory *artifactInventory,
  outcome swaggerDocumentOutcome,
) []string {
  if inventory == nil {
    return nil
  }
  if outcome.Rejected {
    message := swaggerNormalizationFailure(source, outcome.Problem)
    inventory.LoadFailed = true
    inventory.Problems = append(inventory.Problems, inventoryProblem{
      Symbol:  "operation",
      Message: message,
    })
    return []string{message}
  }
  problems := []string{}
  for _, operation := range outcome.Operations {
    unit, problem := swaggerOperationUnit(source, operation)
    if problem != "" {
      inventory.Problems = append(inventory.Problems, inventoryProblem{
        Symbol:  "operation",
        Message: problem,
      })
      problems = append(problems, problem)
      continue
    }
    inventory.Units = append(inventory.Units, unit)
  }
  sortUnits(inventory.Units)
  return problems
}

// swaggerNormalizationFailure words a rejected source identically whether the
// rejection arrived from the normalizer this cycle or from memory, so a reader
// cannot tell the two apart and has no reason to want to.
//
// A reason-less rejection still gets a sentence. The reason comes from another
// process and this rule cannot require it to be non-empty, and a diagnostic
// that trails off after a colon reads like a formatting bug rather than a
// broken document.
func swaggerNormalizationFailure(source string, message string) string {
  reason := causeReason(strings.TrimSpace(message))
  if reason == "" {
    reason = "the normalizer reported no reason"
  }
  return "Evidence graph could not normalize Swagger source '" +
    displaySwaggerSource(source) +
    "' to @typia/interface OpenApi.IDocument: " +
    reason +
    ". Fix the file or URL so @typia/utils can upgrade it."
}
