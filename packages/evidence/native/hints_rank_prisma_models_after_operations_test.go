package evidence

import (
  "strings"
  "testing"
)

// TestHintsRankPrismaModelsAfterOperations verifies the corpus offers Markdown
// headings, then file targets, then Swagger operations, then Prisma models.
//
// Slice order is the corpus's only ranking channel, and a Prisma model is the
// one population that follows every other, so a ranking that lists only three
// tiers would leave its position to chance. Inventories are built by hand,
// because materializing a Prisma schema or a Swagger document starts a Node
// process and this assertion is about ranking rather than parsing.
//
// 1. Build one heading, one file target, one Swagger operation and one Prisma model.
// 2. Project the corpus population through every reference of one claim.
// 3. Assert the four targets are offered in tier order.
//
// @evidence contracts/testing.md#behavioral-verification selectedCompletionUnits projects hand-authored Markdown, Swagger and Prisma inventories selected by three references of one decoded claim and must return the heading, the file, the operation and the model in that order.
// @evidence contracts/testing.md#independent-expectations The expected order is the declared ranking, headings then files then operations then models, written as one literal string of targets; it is not read back from the function or from the order the inventories were built in.
// @evidence contracts/testing.md#distinguishing-cases Each tier holds one unit, so any transposition of two adjacent tiers or any dropped tier changes the joined output; the units are authored in reverse of the expected order so insertion order cannot pass by accident.
// @evidence contracts/testing.md#execution-ownership TestHintsRankPrismaModelsAfterOperations is the Go unit entry discovered beside the native package; decodeGraphConfig and selectedCompletionUnits operate on authored inventory objects in one process, and neither the Swagger nor the Prisma bridge is started.
func TestHintsRankPrismaModelsAfterOperations(t *testing.T) {
  config, problems := decodeGraphConfig([]byte(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":[
      {"type":"prisma","files":["prisma/**/*.prisma"],"symbol":"model"},
      {"type":"swagger","file":"openapi.json"},
      {"type":"markdown","files":["docs/**"],"symbol":["file","h2"]}
    ]
  }]}`))
  if len(problems) != 0 {
    t.Fatalf("fixture configuration must decode, got:\n%s", strings.Join(problems, "\n"))
  }
  prisma := map[string]*artifactInventory{
    "prisma/schema.prisma": {
      Path: "prisma/schema.prisma",
      Type: artifactPrisma,
      Units: []*evidenceUnit{{
        ID:       "prisma:prisma/schema.prisma:Sale",
        Target:   "prisma:Sale",
        Type:     artifactPrisma,
        Symbol:   "model",
        Path:     "prisma/schema.prisma",
        Line:     1,
        Readable: "Prisma model 'Sale'",
      }},
    },
  }
  swagger := map[string]*artifactInventory{
    "openapi.json": {
      Path: "openapi.json",
      Type: artifactSwagger,
      Units: []*evidenceUnit{{
        ID:       "swagger:openapi.json:POST:/members",
        Target:   "POST:/members",
        Type:     artifactSwagger,
        Symbol:   "operation",
        Path:     "openapi.json",
        Readable: "Swagger operation 'POST /members'",
      }},
    },
  }
  markdown := map[string]*artifactInventory{
    "docs/pricing.md": {
      Path: "docs/pricing.md",
      Type: artifactMarkdown,
      Units: []*evidenceUnit{{
        ID:       "markdown:docs/pricing.md:file",
        Target:   "docs/pricing.md",
        Type:     artifactMarkdown,
        Symbol:   "file",
        Path:     "docs/pricing.md",
        Line:     1,
        Readable: "Markdown file",
      }, {
        ID:       "markdown:docs/pricing.md:h2:1",
        Target:   "docs/pricing.md#sale-price",
        Type:     artifactMarkdown,
        Symbol:   "h2",
        Path:     "docs/pricing.md",
        Line:     1,
        Readable: "Markdown H2 'Sale Price'",
      }},
    },
  }
  units := selectedCompletionUnits(
    anchoredGraph("", config),
    markdown,
    prisma,
    swagger,
    false,
  )
  targets := make([]string, 0, len(units))
  for _, unit := range units {
    targets = append(targets, unit.Target)
  }
  want := "docs/pricing.md#sale-price\ndocs/pricing.md\nPOST:/members\nprisma:Sale"
  if strings.Join(targets, "\n") != want {
    t.Fatalf("corpus order:\n%s\nwant:\n%s", strings.Join(targets, "\n"), want)
  }
}
