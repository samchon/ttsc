package evidence

import (
  "os"
  "path/filepath"
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies a Prisma population collects schema files above the project, and
 * that one file reached through two roots joins the parser's set once.
 *
 * The set is what makes Prisma different from Markdown here. Every configured
 * file is parsed together as one schema, so a file listed twice is a duplicate
 * declaration to Prisma's own parser — a file reachable through two roots must
 * therefore own two inventories and still contribute one source. The walk is
 * exercised rather than the whole loader because the parse crosses a process
 * boundary the e2e suite owns.
 *
 *  1. Place one schema beside the project and one inside it.
 *  2. Collect the addresses of a rooted population and a project-rooted one
 *     that overlap on the inner schema.
 *  3. Assert both files are addressed and the shared one is sent once.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification configuredPrismaAddresses returns three addresses and distinctPrismaSources returns two sources.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Literal sibling/inner paths fix the sorted address and deduplicated source expectations.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Inner schema has two population addresses but one parser input; no Prisma parse executes.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestRootedPrismaPopulationsCollectAcrossBasesWithoutDuplicating is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestRootedPrismaPopulationsCollectAcrossBasesWithoutDuplicating(t *testing.T) {
  workspace := t.TempDir()
  root := filepath.Join(workspace, "project")
  for _, relative := range []string{
    "schema/main.prisma",
    "project/prisma/local.prisma",
  } {
    absolute := filepath.Join(workspace, filepath.FromSlash(relative))
    if err := os.MkdirAll(filepath.Dir(absolute), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(absolute, []byte("model Sale {\n  id String @id\n}\n"), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  config := decodeInventoryConfig(t, root, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":[
      {"type":"prisma","root":"../schema","files":["**/*.prisma"]},
      {"type":"prisma","files":["prisma/**/*.prisma"]},
      {"type":"prisma","root":"prisma","files":["**/*.prisma"]}
    ]
  }]}`)
  addresses, problems := configuredPrismaAddresses(config)
  if len(problems) != 0 {
    t.Fatalf("configured roots must be readable, got %v", problems)
  }
  displays := []string{}
  for _, address := range addresses {
    displays = append(displays, address.Display)
  }
  sort.Strings(displays)
  // Three populations, three addresses: the inner schema is reached through
  // the project base and through its own root, and each owns its own globs.
  want := "../schema/main.prisma\nprisma/local.prisma\nprisma/local.prisma"
  if strings.Join(displays, "\n") != want {
    t.Fatalf("addressed schemas:\n%s\nwant:\n%s", strings.Join(displays, "\n"), want)
  }
  set := distinctPrismaSources(root, addresses)
  if strings.Join(set.Sources, "\n") != "../schema/main.prisma\nprisma/local.prisma" {
    t.Fatalf("parser set = %v; a file reached twice must be parsed once", set.Sources)
  }
}
