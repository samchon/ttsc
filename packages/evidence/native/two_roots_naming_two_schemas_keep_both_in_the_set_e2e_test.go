//go:build e2e

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
 * @evidence contracts/testing.md#behavioral-verification Two different schemas (model sale under store, model refund under mirror) with a typescript claim rooted at each: configuredPrismaAddressesWithHealth reports no problem, distinctPrismaSources returns both files (mirror/main.prisma, store/main.prisma), and loadPrismaInventories reports no problem with store's first unit prisma:sale and mirror's first unit prisma:refund.
 * @evidence contracts/testing.md#independent-expectations Expected sources, unit IDs and the absence of problems are literal; two physically distinct files must stay distinct, which the filesystem (os.SameFile) decides.
 * @evidence contracts/testing.md#distinguishing-cases The negative twin of the hard-link, directory-link and case-only cases: two files sharing only a base-relative name main.prisma must not merge. Same-name-different-content is covered; same bytes in two files is not.
 * @evidence contracts/testing.md#execution-ownership TestTwoRootsNamingTwoSchemasKeepBothInTheSet is a Go test entry of package evidence run by the shared Evidence E2E experiment with go test -tags=e2e of packages/evidence; it calls configuredPrismaAddressesWithHealth, distinctPrismaSources and loadPrismaInventories (Node parser: two distinct files, so a new parse unless cached). It starts no native sidecar and builds no TypeScript project.
 * @evidence contracts/e2e.md#necessary-boundary loadPrismaInventories (via normalizePrismaSet) starts a Node child (node -e with the embedded bridge script) that resolves @ttsc/evidence from the fixture root created under packages/evidence/native through Node package self-reference and runs lib/internal/loadPrismaModels.js with a Prisma schema parser, and Go decodes the child's JSON. A hand-built result struct would bypass package resolution, the child process and the JSON transport. The distinct-file identity check needs a real filesystem.
 * @evidence contracts/e2e.md#shared-execution One loadPrismaInventories call over one fixture root; at most one Node child (none on a schema-cache hit); the pure distinctPrismaSources and address calls start no process.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Both schemas live inside the test's own root; prismaBridgeRoot creates a fixture directory under packages/evidence/native via MkdirTemp and registers RemoveAll with t.Cleanup. This path reads the in-process prismaSchemas cache keyed by content digest, so when an earlier test in the same process already parsed identical bytes under the same source spelling the Node child is skipped; whether it launches depends on test order and this test does not force a cold parse.
 * @evidence contracts/e2e.md#preserved-coverage The body asserts both root addresses are healthy, the two-entry parser set, a clean load, and each population's own first unit; it does not assert what the Node child received.
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
