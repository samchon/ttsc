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
