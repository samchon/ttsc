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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification loadPrismaInventories, configuredPrismaAddressesWithHealth is exercised with the scenario below; the assertions require the parser is handed both and each population keeps its own model.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The negative twin of the two shared-file cases, and the one that keeps the repair from being a collapse. Identity by file must merge only what the filesystem says is one file; two schemas that merely share a base-relative spelling are two files, and folding them together would hide a model rather than a duplicate.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Write a different schema under each root. Root one Prisma reference at each. Assert the parser is handed both and each population keeps its own model.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestTwoRootsNamingTwoSchemasKeepBothInTheSet runs in tests/test-evidence/go/e2e, selected by the repository Go overlay runner in the shared native package process. prismaBridgeRoot resolves the installed package and loadPrismaInventories can launch its real Node parser.
 * @evidence .agents/skills/contracts/e2e.md#necessary-boundary The Prisma Node bridge resolves the installed @ttsc/evidence loader and pinned parser for this shared-schema layout. A synthetic outcome cannot detect failed package resolution or transport of the schema set. Equivalent warm outcomes can bypass the process, so this entry verifies that two roots naming two distinct files still compose a set of two. This entry does not independently prove a cold bridge launch.
 * @evidence .agents/skills/contracts/e2e.md#shared-execution The overlay batch shares its Go process, installed @ttsc/evidence package and compiled Node loader. Schema outcomes are reused by content digest; different link layouts need separate fixture roots, not separate installations or native builds.
 * @evidence .agents/skills/contracts/e2e.md#state-isolation-and-reuse-validity prismaBridgeRoot gives this entry a separate temporary consumer root and registers removal with t.Cleanup. File links and graph inputs stay inside that root. The bounded schema cache may reuse identical bytes and representative paths across roots; this test does not require a cold parse.
 * @evidence .agents/skills/contracts/e2e.md#preserved-coverage TestTwoRootsNamingTwoSchemasKeepBothInTheSet retains its original body, fixture inputs, skips and every assertion after transfer from one_schema_reached_by_two_roots_is_parsed_once_test.go. Its checks require the parser is handed both and each population keeps its own model. The synthetic unlocated-model fan-out case remains a unit entry.
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
