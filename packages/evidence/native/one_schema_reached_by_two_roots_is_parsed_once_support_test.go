package evidence

import (
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
