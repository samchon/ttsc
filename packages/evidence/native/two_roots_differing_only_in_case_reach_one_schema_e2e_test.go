//go:build e2e

package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies two roots differing only in case reach one schema, not two.
 *
 * This is the companion of the linked-directory case, and it is the one
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
 * @evidence contracts/testing.md#behavioral-verification store/main.prisma is written and the test skips unless STORE/main.prisma also resolves (case-insensitive volume). A typescript claim references prisma roots store and STORE; loadPrismaInventories must report no problem, expose populations STORE/main.prisma and store/main.prisma, give each the units prisma:sale and prisma:sale.id, and the first unit must be pointer-identical across both.
 * @evidence contracts/testing.md#independent-expectations Expected paths, unit IDs and pointer identity are literals/identities authored from the contract that one physical file is one parse; there is no external oracle for the volume's case rule beyond the os.Stat probe of the upper-case root.
 * @evidence contracts/testing.md#distinguishing-cases Case-only difference between roots (no link involved), contrasted with the hard-link and linked-directory siblings; it runs only on case-insensitive volumes, so on a case-sensitive volume nothing is asserted.
 * @evidence contracts/testing.md#execution-ownership TestTwoRootsDifferingOnlyInCaseReachOneSchema is a Go test entry of package evidence run by the shared Evidence E2E experiment with go test -tags=e2e of packages/evidence; it calls loadPrismaInventories (Node parser only on a schema-cache miss). It starts no native sidecar and builds no TypeScript project.
 * @evidence contracts/e2e.md#necessary-boundary On a schema-cache miss, loadPrismaInventories (via normalizePrismaSet) starts a Node child (node -e with the embedded bridge script) that resolves @ttsc/evidence from the fixture root created under packages/evidence/native through Node package self-reference and runs lib/internal/loadPrismaModels.js with a Prisma schema parser, and Go decodes the child's JSON. A hand-built result struct would bypass package resolution, the child process and the JSON transport. Case-insensitive identity needs the real volume.
 * @evidence contracts/e2e.md#shared-execution One loadPrismaInventories call over one fixture root; at most one Node child (none on a schema-cache hit).
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The case-variant lookup is made against the test's own root; prismaBridgeRoot creates a fixture directory under packages/evidence/native via MkdirTemp and registers RemoveAll with t.Cleanup. This path reads the in-process prismaSchemas cache keyed by content digest, so when an earlier test in the same process already parsed identical bytes under the same source spelling the Node child is skipped; whether it launches depends on test order and this test does not force a cold parse.
 * @evidence contracts/e2e.md#preserved-coverage The body asserts a clean load, the two populations' paths, identical unit IDs per population and a shared unit pointer; nothing is asserted when the volume distinguishes case (skip).
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
