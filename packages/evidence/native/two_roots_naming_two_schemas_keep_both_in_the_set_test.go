package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies two roots naming two distinct files still compose a set of two.
 *
 * The negative twin of the two shared-file cases, and the one that keeps the repair from
 * being a collapse. Identity by file must merge only what the filesystem says
 * is one file; two schemas that merely share a base-relative spelling are two
 * files, and folding them together would hide a model rather than a duplicate.
 *
 *  1. Write a different schema under each root.
 *  2. Root one Prisma reference at each.
 *  3. Assert the parser is handed both and each population keeps its own model.
 *
 * @evidence contracts/testing.md#behavioral-verification Two different schemas (model sale under store, model refund under mirror) with a typescript claim rooted at each: configuredPrismaAddressesWithHealth reports no problem, distinctPrismaSources returns both files (mirror/main.prisma, store/main.prisma), and loadPrismaInventories reports no problem with store's first unit prisma:sale and mirror's first unit prisma:refund.
 * @evidence contracts/testing.md#independent-expectations Expected sources, unit IDs and the absence of problems are literal; two physically distinct files must stay distinct, which the filesystem (os.SameFile) decides.
 * @evidence contracts/testing.md#distinguishing-cases The negative twin of the hard-link, directory-link and case-only cases: two files sharing only a base-relative name main.prisma must not merge. Same-name-different-content is covered; same bytes in two files is not.
 * @evidence contracts/testing.md#execution-ownership TestTwoRootsNamingTwoSchemasKeepBothInTheSet is a Go unit entry of package evidence, run by go test in the package process. It calls the loader functions it names and, through them, the Node parser or normalizer child that the built lib/internal loader provides; it starts no ttsc check, lint sidecar or installed consumer.
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
