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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification loadPrismaInventories is exercised with the scenario below; the assertions require one parse, and both populations carrying it.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations #1262's acceptance names this beside the linked directory, and it is the one shape a comparison of spellings cannot even approximate: the two roots differ by a letter's case, the filesystem calls them one directory, and no normalization this rule could write would know which volumes agree. Asking the filesystem is what makes it answerable, and it is why identity here is `os.SameFile` rather than a canonical spelling of a path. The skip is a property of the volume rather than of the operating system. A case-insensitive macOS volume reaches this and a case-sensitive Windows one does not, so the case runs wherever the shape exists.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Write one schema and name its directory again in another case. Root one Prisma reference at each spelling. Assert one parse, and both populations carrying it.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestTwoRootsDifferingOnlyInCaseReachOneSchema runs in tests/test-evidence/go/e2e, selected by the repository Go overlay runner in the shared native package process. prismaBridgeRoot resolves the installed package and loadPrismaInventories can launch its real Node parser.
 * @evidence .agents/skills/contracts/e2e.md#necessary-boundary The Prisma Node bridge resolves the installed @ttsc/evidence loader and pinned parser for this shared-schema layout. A synthetic outcome cannot detect failed package resolution or transport of the schema set. Equivalent warm outcomes can bypass the process, so this entry verifies that two roots differing only in case reach one schema, not two. This entry does not independently prove a cold bridge launch.
 * @evidence .agents/skills/contracts/e2e.md#shared-execution The overlay batch shares its Go process, installed @ttsc/evidence package and compiled Node loader. Schema outcomes are reused by content digest; different link layouts need separate fixture roots, not separate installations or native builds.
 * @evidence .agents/skills/contracts/e2e.md#state-isolation-and-reuse-validity prismaBridgeRoot gives this entry a separate temporary consumer root and registers removal with t.Cleanup. File links and graph inputs stay inside that root. The bounded schema cache may reuse identical bytes and representative paths across roots; this test does not require a cold parse.
 * @evidence .agents/skills/contracts/e2e.md#preserved-coverage TestTwoRootsDifferingOnlyInCaseReachOneSchema retains its original body, fixture inputs, skips and every assertion after transfer from one_schema_reached_by_two_roots_is_parsed_once_test.go. Its checks require one parse, and both populations carrying it. The synthetic unlocated-model fan-out case remains a unit entry.
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
