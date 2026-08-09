package evidence

import (
  "crypto/sha256"
  "encoding/hex"
  "os"
  "strings"
  "sync"
)

// prismaCacheLimit bounds the cache so a resident host cannot grow without end.
// A project declares one schema set, so several entries only accumulate as its
// bytes change; the bound is a backstop against a pathological session rather
// than a tuning knob.
const prismaCacheLimit = 16

// prismaSchemas remembers parse outcomes by schema content.
//
// This is the rule's own state, not the project state the host publishes, for
// the reason `swaggerDocuments` states at length: the contributor API exposes
// no disposal hook, both resident hosts are line-protocol loops in one process,
// and a project rule runs before any file rule so the parallel walk never
// reaches it.
var prismaSchemas = newPrismaCache()

// prismaSetOutcome is what one schema set's bytes parsed to.
//
// Failure is remembered as deliberately as success. A schema the parser rejects
// is one the author is midway through fixing, and while they fix it every
// unrelated TypeScript save would otherwise pay a fresh process start to be
// told the same thing again. Nothing is cached forever: repairing the schema
// changes its bytes, which changes the key, which misses.
//
// Rejected is a separate flag rather than a non-empty Problem, because the
// reason is the parser's string and this rule does not get to assume it is
// non-empty. Inferring rejection from the message would turn a reason-less
// failure into zero models and no diagnostic — a rejected schema that reads
// exactly like an empty but passing one.
type prismaSetOutcome struct {
  Models   []prismaModel
  Rejected bool
  Problem  string
  // digest is the loader's own, carried out of the bridge answer so the
  // caller stores under the bytes the loader read rather than the ones this
  // process read beforehand.
  digest string
}

func newPrismaCache() *prismaCache {
  return &prismaCache{entries: map[string]prismaSetOutcome{}}
}

type prismaCache struct {
  mutex   sync.Mutex
  entries map[string]prismaSetOutcome
  order   []string
}

func (cache *prismaCache) lookup(digest string) (prismaSetOutcome, bool) {
  if digest == "" {
    return prismaSetOutcome{}, false
  }
  cache.mutex.Lock()
  defer cache.mutex.Unlock()
  outcome, hit := cache.entries[digest]
  if !hit {
    return prismaSetOutcome{}, false
  }
  return copyPrismaOutcome(outcome), true
}

func (cache *prismaCache) store(digest string, outcome prismaSetOutcome) {
  if digest == "" {
    return
  }
  cache.mutex.Lock()
  defer cache.mutex.Unlock()
  if _, exists := cache.entries[digest]; exists {
    return
  }
  if len(cache.order) >= prismaCacheLimit {
    delete(cache.entries, cache.order[0])
    cache.order = cache.order[1:]
  }
  cache.entries[digest] = copyPrismaOutcome(outcome)
  cache.order = append(cache.order, digest)
}

// copyPrismaOutcome deep-copies the models, because a caller builds units from
// them while another cycle may be reading the same entry.
//
// The copy is written field by field so that only `Fields` is reallocated, and
// that is exactly why it has to name every other field: one left out is served
// as its zero value on every cache hit and on no cache miss. `Digest` was, so a
// resident host asked for one model fingerprint on its first cycle and a
// different one on every cycle after, which no edit could repair.
func copyPrismaOutcome(outcome prismaSetOutcome) prismaSetOutcome {
  models := make([]prismaModel, 0, len(outcome.Models))
  for _, model := range outcome.Models {
    models = append(models, prismaModel{
      Name:          model.Name,
      Documentation: model.Documentation,
      Digest:        model.Digest,
      Fields:        append([]prismaField(nil), model.Fields...),
    })
  }
  return prismaSetOutcome{
    Models:   models,
    Rejected: outcome.Rejected,
    Problem:  outcome.Problem,
    digest:   outcome.digest,
  }
}

// prismaContentDigest composes one key from every file of the ordered set.
//
// The composition is the whole cache key, which is what makes staleness
// structural rather than improbable: identical bytes in identical order parse
// to identical models, so a hit can only return what the current schema means.
// The path is folded in beside each file's own hash, so moving a model between
// two files of one set — which changes nothing about the bytes as a whole —
// still changes the key, and so does adding or removing a file.
//
// An unreadable file yields no digest at all, which keeps the set out of the
// cache and leaves the loader's own diagnostic for it.
func prismaContentDigest(root string, sources []string) string {
  composite := sha256.New()
  for _, source := range sources {
    content, err := os.ReadFile(resolveProjectPath(root, source))
    if err != nil {
      return ""
    }
    file := sha256.Sum256(content)
    composite.Write([]byte(source))
    // NUL, matching `SEPARATOR` in the bridge. A path may contain a space
    // while a hex digest contains nothing outside `[0-9a-f]`, so an
    // ambiguous separator would let two different sets compose one key.
    // Spelled as a byte rather than as a literal character for the reason
    // the bridge records: this separator was once an invisible control
    // character in one source and a space in the other, and the two hashed
    // differently with every result still correct.
    composite.Write([]byte{0})
    composite.Write([]byte(hex.EncodeToString(file[:])))
    composite.Write([]byte("\n"))
  }
  return hex.EncodeToString(composite.Sum(nil))
}

// rememberPrismaSchema records an outcome under the bytes it was produced from,
// as reported by the process that produced it.
//
// The digest is the loader's own, never the one this process took beforehand.
// The loader opens the files again, in another process, after this one read
// them — so keying on the earlier digest would let a write landing inside that
// window bind one schema's models to another schema's bytes, and that entry
// would answer every later cycle with the wrong schema.
func rememberPrismaSchema(digest string, outcome prismaSetOutcome) {
  prismaSchemas.store(digest, outcome)
}

// prismaUnitsFromOutcome rebuilds the set's units and files them under the
// schema file each one is written in.
//
// Units are rebuilt per cycle rather than remembered, because a unit carries
// its location while the parsed models do not: what was cached is a property of
// the schema, not of where its text sits.
func prismaUnitsFromOutcome(
  root string,
  sources []string,
  inventories map[string]*artifactInventory,
  outcome prismaSetOutcome,
) []string {
  if outcome.Rejected {
    return []string{failPrismaSet(
      inventories,
      sources,
      prismaNormalizationFailure(outcome.Problem),
    )}
  }
  locations, comments := locatePrismaDeclarations(root, sources)
  fallback := ""
  if len(sources) != 0 {
    fallback = sources[0]
  }
  indexed := prismaInventoriesByDisplay(inventories)
  hosts := map[string]*evidenceUnit{}
  for _, model := range outcome.Models {
    for _, unit := range prismaModelUnits(model) {
      key := joinPrismaIdentity(unit.Identity)
      location, found := locations[key]
      if !found {
        // Locating is subordinate: a name the scan did not find keeps a
        // file-level location and its full participation in coverage,
        // because every file of the set matches the globs that selected
        // it. A missing line costs precision, never an obligation.
        location = prismaLocation{Path: fallback}
      }
      unit.Path = location.Path
      unit.Line = location.Line
      hosts[key] = unit
      for _, inventory := range indexed[unit.Path] {
        inventory.Units = append(inventory.Units, unit)
      }
    }
  }
  for _, inventory := range inventories {
    sortUnits(inventory.Units)
  }
  return prismaDeclarationsFromComments(comments, hosts, indexed)
}

// joinPrismaIdentity renders a unit's identity the way the locator keys one.
//
// A Prisma identifier is unicode alphanumeric plus `_` and `-` and can never
// contain a dot (`psl/schema-ast/src/parser/datamodel.pest`), so joining on one
// is lossless here — the ambiguity that forces a TypeScript identity to stay
// segmented does not exist in this grammar.
func joinPrismaIdentity(identity []string) string {
  return strings.Join(identity, ".")
}
