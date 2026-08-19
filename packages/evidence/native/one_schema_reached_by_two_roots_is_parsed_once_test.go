package evidence

import (
  "os"
  "path/filepath"
  "sort"
  "strings"
  "testing"
)

// twoRootedPrismaGraph configures one claim whose two Prisma references reach a
// schema through two different roots.
func twoRootedPrismaGraph(t *testing.T, root string) graphConfig {
  t.Helper()
  return decodeInventoryConfig(t, root, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":[
      {"type":"prisma","root":"store","files":["**/*.prisma"],"symbol":"model"},
      {"type":"prisma","root":"mirror","files":["**/*.prisma"],"symbol":"model"}
    ]
  }]}`)
}

// prismaPopulationPaths lists the spelling each loaded inventory answers by.
func prismaPopulationPaths(inventories map[string]*artifactInventory) []string {
  paths := []string{}
  for _, inventory := range inventories {
    paths = append(paths, inventory.Path)
  }
  sort.Strings(paths)
  return paths
}

// prismaInventoryAt returns the single inventory whose spelling is this one.
func prismaInventoryAt(
  t *testing.T,
  inventories map[string]*artifactInventory,
  path string,
) *artifactInventory {
  t.Helper()
  found := []*artifactInventory{}
  for _, inventory := range inventories {
    if inventory.Path == path {
      found = append(found, inventory)
    }
  }
  if len(found) != 1 {
    t.Fatalf("population '%s' must own exactly one inventory, got %d", path, len(found))
  }
  return found[0]
}

// assertBothPopulationsServed pins the whole product of one parse reaching two
// populations of one file.
func assertBothPopulationsServed(
  t *testing.T,
  inventories map[string]*artifactInventory,
  problems []string,
) {
  t.Helper()
  if len(problems) != 0 {
    t.Fatalf("one schema reached twice must parse cleanly, got: %v", problems)
  }
  paths := prismaPopulationPaths(inventories)
  if strings.Join(paths, "\n") != "mirror/main.prisma\nstore/main.prisma" {
    t.Fatalf("populations = %v; each root owns its own inventory of the file", paths)
  }
  store := prismaInventoryAt(t, inventories, "store/main.prisma")
  mirror := prismaInventoryAt(t, inventories, "mirror/main.prisma")
  for _, inventory := range []*artifactInventory{store, mirror} {
    if inventory.LoadFailed {
      t.Fatalf("population '%s' must not be failed by a file it shares", inventory.Path)
    }
    if len(inventory.Problems) != 0 {
      t.Fatalf("population '%s' reported %v", inventory.Path, inventory.Problems)
    }
  }
  // The whole point of the fan-out: the parse ran once, and neither population
  // is the one that got it.
  identities := map[string][]string{}
  for _, inventory := range []*artifactInventory{store, mirror} {
    for _, unit := range inventory.Units {
      identities[inventory.Path] = append(identities[inventory.Path], unit.ID)
    }
  }
  if strings.Join(identities["store/main.prisma"], ",") != "prisma:sale,prisma:sale.id" {
    t.Fatalf("store units = %v; want the model and its column", identities["store/main.prisma"])
  }
  if strings.Join(identities["mirror/main.prisma"], ",") != "prisma:sale,prisma:sale.id" {
    t.Fatalf("mirror units = %v; the second root is served by the same parse", identities["mirror/main.prisma"])
  }
  if store.Units[0] != mirror.Units[0] {
    t.Fatal("one model reached by two roots must be one unit, not two identities for one declaration")
  }
  // Which spelling the one result is addressed by is the smallest of them, so
  // that a location is a property of the configuration rather than of the order
  // a walk produced. Without this the representative could be either root and
  // nothing would notice, while a diagnostic's location would move with an
  // unrelated edit to the other population's globs.
  if store.Units[0].Path != "mirror/main.prisma" {
    t.Fatalf(
      "the shared model is located at '%s'; the set is addressed by the smallest spelling of the file",
      store.Units[0].Path,
    )
  }
  // A citation written in the shared file is one declaration too, for the same
  // reason: `evaluateEvidenceGraph` keys them by ID, and a second copy would be
  // a second obligation nothing can acknowledge twice.
  if len(store.Declarations) != 1 || len(mirror.Declarations) != 1 {
    t.Fatalf(
      "declarations = %d and %d; the citation in the shared file belongs to both populations",
      len(store.Declarations),
      len(mirror.Declarations),
    )
  }
  if store.Declarations[0] != mirror.Declarations[0] {
    t.Fatal("one citation reached by two roots must be one declaration")
  }
}

/**
 * Verifies one schema hard-linked into two roots is parsed once and serves both.
 *
 * This is the layout a package manager produces. pnpm materializes a package by
 * hard-linking its files out of the content store, so a schema installed twice
 * — as a dependency and as the workspace source of that dependency — is one
 * file on disk under two paths, and a graph that roots a population at each of
 * them names one file twice. Prisma parses a set, and the same model declared
 * twice in that set is rejected as a duplicate, so the configuration failed at
 * the schema instead of at itself. Identity is therefore the file's, not the
 * path's.
 *
 *  1. Write one schema and hard-link it into a second root.
 *  2. Root one Prisma reference at each.
 *  3. Assert the set parsed cleanly and both populations carry the one result.
 */
func TestOneSchemaHardLinkedIntoTwoRootsIsParsedOnce(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "store/main.prisma": "/// @evidence https://example.com/sale\nmodel sale {\n  id String @id\n}\n",
  })
  if err := os.MkdirAll(filepath.Join(root, "mirror"), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.Link(
    filepath.Join(root, "store", "main.prisma"),
    filepath.Join(root, "mirror", "main.prisma"),
  ); err != nil {
    t.Skipf("this filesystem does not support hard links: %v", err)
  }
  inventories, problems := loadPrismaInventories(root, twoRootedPrismaGraph(t, root))
  assertBothPopulationsServed(t, inventories, problems)
}

/**
 * Verifies one schema reached through a linked directory is parsed once too.
 *
 * The other half of the same package layout: pnpm's `node_modules` entries are
 * symbolic links into `node_modules/.pnpm`, and on Windows a junction. The two
 * roots are then two spellings of one directory rather than two names of one
 * file, which no comparison of paths can collapse and which `os.SameFile`
 * answers without knowing a link was involved at all.
 *
 * Run beside the case above this is a schema cache hit, because identical bytes
 * under an identical representative spelling compose one digest. That is the
 * coverage worth having — the fan-out is then proved on the cache's hit branch
 * as well as on its miss branch — and the case still measures the whole
 * round trip when it runs alone.
 *
 *  1. Write one schema and link its directory under a second name.
 *  2. Root one Prisma reference at each.
 *  3. Assert the set parsed cleanly and both populations carry the one result.
 */
func TestOneSchemaReachedThroughALinkedDirectoryIsParsedOnce(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "store/main.prisma": "/// @evidence https://example.com/sale\nmodel sale {\n  id String @id\n}\n",
  })
  if err := linkDirectory(
    filepath.Join(root, "store"),
    filepath.Join(root, "mirror"),
  ); err != nil {
    t.Skipf("this environment cannot create a directory link: %v", err)
  }
  inventories, problems := loadPrismaInventories(root, twoRootedPrismaGraph(t, root))
  assertBothPopulationsServed(t, inventories, problems)
}

/**
 * Verifies two roots naming two distinct files still compose a set of two.
 *
 * The negative twin of the two above, and the one that keeps the repair from
 * being a collapse. Identity by file must merge only what the filesystem says
 * is one file; two schemas that merely share a base-relative spelling are two
 * files, and folding them together would hide a model rather than a duplicate.
 *
 *  1. Write a different schema under each root.
 *  2. Root one Prisma reference at each.
 *  3. Assert the parser is handed both and each population keeps its own model.
 */
func TestTwoRootsNamingTwoSchemasKeepBothInTheSet(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "store/main.prisma":  "model sale {\n  id String @id\n}\n",
    "mirror/main.prisma": "model refund {\n  id String @id\n}\n",
  })
  config := twoRootedPrismaGraph(t, root)
  addresses, _, problems := configuredPrismaAddressesWithHealth(config)
  if len(problems) != 0 {
    t.Fatalf("both roots must be readable, got %v", problems)
  }
  set := distinctPrismaSources(root, addresses)
  if strings.Join(set.Sources, "\n") != "mirror/main.prisma\nstore/main.prisma" {
    t.Fatalf("parser set = %v; two files are two entries", set.Sources)
  }
  inventories, problems := loadPrismaInventories(root, config)
  if len(problems) != 0 {
    t.Fatalf("two distinct schemas must parse cleanly, got: %v", problems)
  }
  store := prismaInventoryAt(t, inventories, "store/main.prisma")
  mirror := prismaInventoryAt(t, inventories, "mirror/main.prisma")
  if len(store.Units) == 0 || store.Units[0].ID != "prisma:sale" {
    t.Fatalf("store units = %v; want its own model", store.Units)
  }
  if len(mirror.Units) == 0 || mirror.Units[0].ID != "prisma:refund" {
    t.Fatalf("mirror units = %v; want its own model", mirror.Units)
  }
}

/**
 * Verifies a schema hard-linked inside one population is cited once, not twice.
 *
 * A hard link is a second directory entry for one file, so a single walk of a
 * single base enumerates both — which is the one shape where a claim's own
 * globs select two spellings of one schema. Parsing it once and serving both
 * entries is what this pull request added, and it made that shape reachable:
 * the parse's declarations are one object filed into both inventories, and a
 * claim that appended each inventory's list saw one citation twice. Every
 * message that follows names a repair the author cannot perform — one tag, on
 * one line, reported as its own duplicate — which is why the correct
 * configuration is what this asserts.
 *
 *  1. Hard-link one schema inside a single claim's base.
 *  2. Cite the reference from the model, correctly and exactly once.
 *  3. Assert the graph closes silently.
 */
func TestASchemaHardLinkedInsideOnePopulationIsCitedOnce(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "store/main.prisma": "/// @evidence docs/pricing.md#discounts Sales are priced by the discount table.\nmodel sale {\n  id String @id\n}\n",
  })
  if err := os.MkdirAll(filepath.Join(root, "mirror"), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.Link(
    filepath.Join(root, "store", "main.prisma"),
    filepath.Join(root, "mirror", "main.prisma"),
  ); err != nil {
    t.Skipf("this filesystem does not support hard links: %v", err)
  }
  messages := runIndexRuleAtRoot(t, root, map[string]string{
    "docs/pricing.md": "## Discounts {#discounts}\n",
  }, `{"claims":[{
    "type":"prisma",
    "files":["**/*.prisma"],
    "symbol":"model",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
  if len(messages) != 0 {
    t.Fatalf(
      "one citation on one line owes nothing, got %d:\n%s",
      len(messages),
      strings.Join(messages, "\n"),
    )
  }
}

/**
 * Verifies a model the scan could not locate reaches every population of the set.
 *
 * The locator is subordinate to the parser: it answers where a name is written
 * and never what exists, so a file it cannot read costs precise lines and no
 * obligations. That held while a set belonged to one population, because every
 * file of the set answered the same globs. A set now spans populations whose
 * roots spell its files differently, and filing such a unit under the first
 * source's spelling alone would hand it to that population and drop it from the
 * others with nothing said — the silent shortfall this campaign exists to
 * remove. The state is reached whenever a file the digest read a moment earlier
 * cannot be read again, which one Windows lock is enough to do.
 *
 *  1. Compose a set of two files under two roots, neither present to be read.
 *  2. Give the outcome a model, so the scan can locate nothing at all.
 *  3. Assert both populations carry it, addressed by the one location there is.
 */
func TestAModelTheScanCouldNotLocateReachesEveryPopulationOfTheSet(t *testing.T) {
  set := prismaSourceSet{
    Sources: []string{"alpha/main.prisma", "beta/main.prisma"},
    Spellings: map[string][]string{
      "alpha/main.prisma": {"alpha/main.prisma"},
      "beta/main.prisma":  {"beta/main.prisma"},
    },
  }
  inventories := map[string]*artifactInventory{
    "alpha": {Path: "alpha/main.prisma", Type: artifactPrisma},
    "beta":  {Path: "beta/main.prisma", Type: artifactPrisma},
  }
  problems := prismaUnitsFromOutcome(t.TempDir(), set, inventories, prismaSetOutcome{
    Models: []prismaModel{{
      Name:   "sale",
      Digest: "model-digest",
      Fields: []prismaField{{Name: "id", Symbol: "column", Digest: "field-digest"}},
    }},
  })
  if len(problems) != 0 {
    t.Fatalf("an unlocated model is not a problem, got %v", problems)
  }
  for _, population := range []string{"alpha", "beta"} {
    units := []string{}
    for _, unit := range inventories[population].Units {
      units = append(units, unit.ID+"@"+unit.location())
    }
    // The location is the set's first source either way, because it is the one
    // path this rule can name and it opens. What must not depend on it is which
    // populations owe the model.
    if strings.Join(units, ",") != "prisma:sale@alpha/main.prisma,prisma:sale.id@alpha/main.prisma" {
      t.Fatalf("population '%s' carries %v; an unlocated model belongs to the whole set", population, units)
    }
  }
}

/**
 * Verifies an exclusion in a shared file is placed by every name it is read by.
 *
 * `evidenceExcludeCarriers` confines a claim's exclusions to some of its own
 * files, and a hard link gives one file two names inside that claim — one of
 * which the carrier patterns select and one of which they do not. Deciding the
 * placement per name put the same tag in two places at once and reported
 * whichever name the walk read second, so a tag written exactly where the
 * configuration demands was refused for sitting somewhere it also is. The tag
 * is in a carrier when any name it is read by is one.
 *
 *  1. Hard-link one schema so a single claim selects it under two names.
 *  2. Confine the exclusions to the name the carriers select.
 *  3. Assert the exclusion is accepted and discharges its obligation.
 */
func TestAnExclusionInASharedFileIsPlacedByEveryNameThatReadsIt(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "store/main.prisma": "/// @evidenceExclude docs/pricing.md#discounts Discounts are priced outside this table.\nmodel sale {\n  id String @id\n}\n",
  })
  if err := os.MkdirAll(filepath.Join(root, "mirror"), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.Link(
    filepath.Join(root, "store", "main.prisma"),
    filepath.Join(root, "mirror", "main.prisma"),
  ); err != nil {
    t.Skipf("this filesystem does not support hard links: %v", err)
  }
  messages := runIndexRuleAtRoot(t, root, map[string]string{
    "docs/pricing.md": "## Discounts {#discounts}\n",
  }, `{"claims":[{
    "type":"prisma",
    "files":["**/*.prisma"],
    "symbol":"model",
    "evidenceExcludeCarriers":["mirror/**"],
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
  if len(messages) != 0 {
    t.Fatalf(
      "an exclusion inside the carriers owes nothing, got %d:\n%s",
      len(messages),
      strings.Join(messages, "\n"),
    )
  }
}

/**
 * Verifies two claims over one shared schema each owe their own reference.
 *
 * The product shape #1262 exists for, at the level an adopter meets it: a
 * package installed under `node_modules` and rooted again at its workspace
 * source is one schema owned by two claims, each answering to its own
 * documents. Before this pull request the whole set was rejected for a model
 * declared twice and neither claim owed anything. Both must now owe exactly
 * their own, and the host they name must be a path that opens — which for a
 * file both claims reached is one of its two spellings rather than each
 * claim's own, and this is where that becomes visible.
 *
 *  1. Hard-link one schema so two rooted claims each own a name for it.
 *  2. Give each claim a different document to answer to.
 *  3. Assert one acknowledgement per claim, each naming its own document.
 */
func TestTwoClaimsOverOneSharedSchemaEachOweTheirOwnReference(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "store/main.prisma": "model sale {\n  id String @id\n}\n",
  })
  if err := os.MkdirAll(filepath.Join(root, "mirror"), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.Link(
    filepath.Join(root, "store", "main.prisma"),
    filepath.Join(root, "mirror", "main.prisma"),
  ); err != nil {
    t.Skipf("this filesystem does not support hard links: %v", err)
  }
  messages := runIndexRuleAtRoot(t, root, map[string]string{
    "docs/installed.md": "## Installed {#installed}\n",
    "docs/source.md":    "## Source {#source}\n",
  }, `{"claims":[
    {
      "type":"prisma",
      "root":"store",
      "files":["**/*.prisma"],
      "symbol":"model",
      "reference":{"type":"markdown","files":["docs/installed.md"],"symbol":"h2"}
    },
    {
      "type":"prisma",
      "root":"mirror",
      "files":["**/*.prisma"],
      "symbol":"model",
      "reference":{"type":"markdown","files":["docs/source.md"],"symbol":"h2"}
    }
  ]}`)
  if len(messages) != 2 {
    t.Fatalf(
      "two claims owe one acknowledgement each, got %d:\n%s",
      len(messages),
      strings.Join(messages, "\n"),
    )
  }
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/installed.md#installed'")
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/source.md#source'")
  // One parse, one model, one location, named the same way to both claims.
  for _, message := range messages {
    if !strings.Contains(message, "on a selected prisma host") {
      t.Fatalf("each claim reports its own prisma obligation:\n%s", message)
    }
  }
}

/**
 * Verifies a diagnostic for a shared schema names the one spelling the set has.
 *
 * The guide and the two TSDoc blocks promise this in words: a file both
 * populations reached is located by one of its spellings rather than by each
 * population's own, and it opens the same file either way. The unit's own
 * location is pinned beside the parse; this is the promise as an adopter meets
 * it, in a message, from the claim rooted at the other name.
 *
 *  1. Root two claims at the two names of one hard-linked schema.
 *  2. Write one citation in it whose target nothing materializes.
 *  3. Assert the report locates it at the set's spelling and at no other.
 */
func TestADiagnosticForASharedSchemaNamesTheSetsSpelling(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "store/main.prisma": "/// @evidence docs/absent.md#nothing Nothing materializes this target.\nmodel sale {\n  id String @id\n}\n",
  })
  if err := os.MkdirAll(filepath.Join(root, "mirror"), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.Link(
    filepath.Join(root, "store", "main.prisma"),
    filepath.Join(root, "mirror", "main.prisma"),
  ); err != nil {
    t.Skipf("this filesystem does not support hard links: %v", err)
  }
  messages := runIndexRuleAtRoot(t, root, map[string]string{
    "docs/pricing.md": "## Discounts {#discounts}\n",
  }, `{"claims":[
    {
      "type":"prisma",
      "root":"store",
      "files":["**/*.prisma"],
      "symbol":"model",
      "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
    },
    {
      "type":"prisma",
      "root":"mirror",
      "files":["**/*.prisma"],
      "symbol":"model",
      "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
    }
  ]}`)
  assertProblemContains(t, messages, "Unresolved evidence target 'docs/absent.md#nothing' at mirror/main.prisma:1")
  // The claim rooted at the other name reports the same location, because one
  // file has one location and both claims read it from the same parse.
  for _, message := range messages {
    if strings.Contains(message, "store/main.prisma") {
      t.Fatalf("a shared schema is located by the set's spelling alone:\n%s", message)
    }
  }
}

/**
 * Verifies two roots differing only in case reach one schema, not two.
 *
 * #1262's acceptance names this beside the linked directory, and it is the one
 * shape a comparison of spellings cannot even approximate: the two roots differ
 * by a letter's case, the filesystem calls them one directory, and no
 * normalization this rule could write would know which volumes agree. Asking
 * the filesystem is what makes it answerable, and it is why identity here is
 * `os.SameFile` rather than a canonical spelling of a path.
 *
 * The skip is a property of the volume rather than of the operating system. A
 * case-insensitive macOS volume reaches this and a case-sensitive Windows one
 * does not, so the case runs wherever the shape exists.
 *
 *  1. Write one schema and name its directory again in another case.
 *  2. Root one Prisma reference at each spelling.
 *  3. Assert one parse, and both populations carrying it.
 */
func TestTwoRootsDifferingOnlyInCaseReachOneSchema(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "store/main.prisma": "/// @evidence https://example.com/sale\nmodel sale {\n  id String @id\n}\n",
  })
  if _, err := os.Stat(filepath.Join(root, "STORE", "main.prisma")); err != nil {
    t.Skipf("this volume distinguishes case, so the two roots are two directories (%v)", err)
  }
  config := decodeInventoryConfig(t, root, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":[
      {"type":"prisma","root":"store","files":["**/*.prisma"],"symbol":"model"},
      {"type":"prisma","root":"STORE","files":["**/*.prisma"],"symbol":"model"}
    ]
  }]}`)
  inventories, problems := loadPrismaInventories(root, config)
  if len(problems) != 0 {
    t.Fatalf("one schema named in two cases must parse cleanly, got: %v", problems)
  }
  paths := prismaPopulationPaths(inventories)
  if strings.Join(paths, "\n") != "STORE/main.prisma\nstore/main.prisma" {
    t.Fatalf("populations = %v; each spelling owns its own inventory of the file", paths)
  }
  upper := prismaInventoryAt(t, inventories, "STORE/main.prisma")
  lower := prismaInventoryAt(t, inventories, "store/main.prisma")
  for _, inventory := range []*artifactInventory{upper, lower} {
    identities := []string{}
    for _, unit := range inventory.Units {
      identities = append(identities, unit.ID)
    }
    if strings.Join(identities, ",") != "prisma:sale,prisma:sale.id" {
      t.Fatalf("population '%s' carries %v; one file is one parse serving both", inventory.Path, identities)
    }
  }
  if upper.Units[0] != lower.Units[0] {
    t.Fatal("one model named in two cases must be one unit")
  }
}
