package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies Swagger operations rank after Markdown headings.
 *
 * Selection is exercised directly rather than through the loader, because
 * materializing a Swagger document spawns Node and this assertion is about
 * ranking rather than about parsing. The loader has its own coverage.
 *
 *  1. Build one Markdown heading and one Swagger operation.
 *  2. Project the corpus population.
 *  3. Assert the operation is offered after the heading.
 *
 * @evidence contracts/testing.md#behavioral-verification selectedCompletionUnits projects manually authored Markdown and Swagger inventories and must return sale-price before POST:/members.
 * @evidence contracts/testing.md#independent-expectations The declared ranking places Markdown anchors ahead of Swagger operation targets. The two literal targets and their authored artifact kinds define the expected order, rather than taking a snapshot of the returned units.
 * @evidence contracts/testing.md#distinguishing-cases One H2 and one POST operation distinguish reversed order and omitted entries through exact joined output. The test does not run the Swagger parser or assert Readable text separately.
 * @evidence contracts/testing.md#execution-ownership TestHintsRankSwaggerOperationsLast is the Go unit entry discovered beside the native package. decodeGraphConfig and selectedCompletionUnits operate on authored inventory objects in one process; the Swagger Node parser is not used.
 */
func TestHintsRankSwaggerOperationsLast(t *testing.T) {
  config, problems := decodeGraphConfig([]byte(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":[
      {"type":"markdown","files":["docs/**"],"symbol":["h2"]},
      {"type":"swagger","file":"openapi.json"}
    ]
  }]}`))
  if len(problems) != 0 {
    t.Fatalf("fixture configuration must decode, got:\n%s", strings.Join(problems, "\n"))
  }
  markdown := map[string]*artifactInventory{
    "docs/pricing.md": {
      Path: "docs/pricing.md",
      Type: artifactMarkdown,
      Units: []*evidenceUnit{{
        ID:       "markdown:docs/pricing.md:#sale-price",
        Target:   "docs/pricing.md#sale-price",
        Type:     artifactMarkdown,
        Symbol:   "h2",
        Path:     "docs/pricing.md",
        Line:     1,
        Readable: "Markdown H2 'Sale Price'",
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
  units := selectedCompletionUnits(
    anchoredGraph("", config),
    markdown,
    map[string]*artifactInventory{},
    swagger,
    false,
  )
  targets := make([]string, 0, len(units))
  for _, unit := range units {
    targets = append(targets, unit.Target)
  }
  want := "docs/pricing.md#sale-price\nPOST:/members"
  if strings.Join(targets, "\n") != want {
    t.Fatalf("corpus order:\n%s\nwant:\n%s", strings.Join(targets, "\n"), want)
  }
}
