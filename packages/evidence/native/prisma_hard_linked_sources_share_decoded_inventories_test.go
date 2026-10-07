package evidence

import (
  "os"
  "path/filepath"
  "reflect"
  "testing"
)

/**
 * Verifies two rooted hard-link spellings share one decoded native population.
 *
 * @evidence contracts/testing.md#behavioral-verification Writes the original sale schema and hard-links store/main.prisma to mirror/main.prisma. configuredPrismaAddresses and distinctPrismaSources must yield two inventories but one canonical source with both spellings. prismaUnitsFromOutcome then attaches the literal decoded sale/id outcome and scanned citation to both populations, preserving pointer identity and the mirror location.
 * @evidence contracts/testing.md#independent-expectations Literal paths, model/column IDs and sorted mirror-first spellings follow rooted population identity and physical-file deduplication. Shared unit/declaration pointers establish one native identity for one physical declaration. The decoded payload is an authored input, not proof of parser admission or process count.
 * @evidence contracts/testing.md#distinguishing-cases Two distinct rooted addresses of one hard-linked physical file must differ as inventory keys while sharing units and citation identity. Full two-unit and one-declaration counts reject dropped or duplicated members. Distinct physical files, linked directories and case-only volume behavior remain separately owned cases; this body retains the hard-link original's schema and citation.
 * @evidence contracts/testing.md#execution-ownership TestPrismaHardLinkedSourcesShareDecodedInventories is one native Go entry exercising the actual filesystem walk, os.SameFile deduplication, locator/comment scan and decoded materializer directly. It creates only a tracked t.TempDir fixture and skips only when the actual volume rejects the hard-link operation. It starts no Node parser, built artifact or product host; original bridge admission is retained until actual survivors execute.
 */
func TestPrismaHardLinkedSourcesShareDecodedInventories(t *testing.T) {
  root := t.TempDir()
  for _, directory := range []string{"store", "mirror"} {
    if err := os.MkdirAll(filepath.Join(root, directory), 0o755); err != nil {
      t.Fatal(err)
    }
  }
  if err := os.WriteFile(filepath.Join(root, "store", "main.prisma"), []byte("/// @evidence https://example.com/sale\nmodel sale {\n  id String @id\n}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  if err := os.Link(filepath.Join(root, "store", "main.prisma"), filepath.Join(root, "mirror", "main.prisma")); err != nil {
    t.Skipf("this filesystem does not support hard links: %v", err)
  }
  config := twoRootedPrismaGraph(t, root)
  addresses, problems := configuredPrismaAddresses(config)
  if len(problems) != 0 || len(addresses) != 2 {
    t.Fatalf("expected two healthy rooted addresses, got %d: %v", len(addresses), problems)
  }
  set := distinctPrismaSources(root, addresses)
  if !reflect.DeepEqual(set.Sources, []string{"mirror/main.prisma"}) ||
    !reflect.DeepEqual(set.Spellings, map[string][]string{"mirror/main.prisma": {"mirror/main.prisma", "store/main.prisma"}}) {
    t.Fatalf("one physical source must keep both sorted spellings: %#v", set)
  }
  inventories := map[string]*artifactInventory{}
  for _, address := range addresses {
    inventories[address.Key] = &artifactInventory{Path: address.Display, Type: artifactPrisma}
  }
  problems = prismaUnitsFromOutcome(root, set, inventories, prismaSetOutcome{
    Models: []prismaModel{{
      Name: "sale", Documentation: "@evidence https://example.com/sale", Digest: "model-content",
      Fields: []prismaField{{Name: "id", Symbol: "column", Digest: "id-content"}},
    }},
  }, config)
  if len(problems) != 0 || len(inventories) != 2 {
    t.Fatalf("decoded fan-out must be clean and retain two inventories: %v", problems)
  }
  store := prismaInventoryAt(t, inventories, "store/main.prisma")
  mirror := prismaInventoryAt(t, inventories, "mirror/main.prisma")
  for _, inventory := range []*artifactInventory{store, mirror} {
    if inventory.LoadFailed || len(inventory.Problems) != 0 ||
      prismaUnitIndex(inventory.Units) != "prisma:sale=model\nprisma:sale.id=column" || len(inventory.Declarations) != 1 {
      t.Fatalf("population %s lost or duplicated decoded members/citation: %#v", inventory.Path, inventory)
    }
  }
  for index := range store.Units {
    if store.Units[index] != mirror.Units[index] || store.Units[index].Path != "mirror/main.prisma" {
      t.Fatalf("unit %d must share identity and canonical mirror location", index)
    }
  }
  if store.Declarations[0] != mirror.Declarations[0] {
    t.Fatal("one physical citation must remain one declaration identity")
  }
}
