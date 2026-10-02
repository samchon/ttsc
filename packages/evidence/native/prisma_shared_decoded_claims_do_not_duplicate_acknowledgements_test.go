package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

/**
 * Verifies shared decoded Prisma citations and carrier exclusions count once.
 *
 * @evidence contracts/testing.md#behavioral-verification Preserves the two original hard-linked one-population fixtures: a positive Discounts citation and an exclusion whose mirror spelling is its configured carrier. Actual walk/dedup, decoded outcome materialization, comment scan and graph evaluation must expose one host/declaration and close silently in both named cases.
 * @evidence contracts/testing.md#independent-expectations Each schema has one model and one tag on one physical line, so alias enumeration cannot create another semantic host or acknowledgement. The mirror name is independently authored as a selected carrier. Literal counts plus no diagnostics reject silent population loss as well as duplicate/placement findings. Authored decoded output does not establish parser admission.
 * @evidence contracts/testing.md#distinguishing-cases Positive citation deduplication contrasts with an exclusion whose other name is outside the carrier pattern. Each uses the exact original schema/document/config semantics. The complete state checks require the obligation and tag to survive before silence is accepted. No-carrier refusal, contradictory tags and two distinct files remain complementary policy cases.
 * @evidence contracts/testing.md#execution-ownership TestPrismaSharedDecodedClaimsDoNotDuplicateAcknowledgements registers two synchronous named native cases. It owns real t.TempDir files/hard links, decoded DTOs and in-process scan/materialization/evaluation. It skips only the original actual os.Link failure boundary, starts no Node child/parser bridge/build/product host, and retains original bridge cases pending actual survivor execution.
 */
func TestPrismaSharedDecodedClaimsDoNotDuplicateAcknowledgements(t *testing.T) {
  for _, scenario := range []struct {
    name string
    schema string
    config string
  }{
    {name: "positive-citation", schema: "/// @evidence docs/pricing.md#discounts Sales are priced by the discount table.\nmodel sale {\n  id String @id\n}\n", config: `{"claims":[{
      "type":"prisma","files":["**/*.prisma"],"symbol":"model",
      "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
    }]}`},
    {name: "carrier-under-one-name", schema: "/// @evidenceExclude docs/pricing.md#discounts Discounts are priced outside this table.\nmodel sale {\n  id String @id\n}\n", config: `{"claims":[{
      "type":"prisma","files":["**/*.prisma"],"symbol":"model",
      "evidenceExcludeCarriers":["mirror/**"],
      "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
    }]}`},
  } {
    t.Run(scenario.name, func(t *testing.T) {
      root := t.TempDir()
      for _, directory := range []string{"store", "mirror"} {
        if err := os.MkdirAll(filepath.Join(root, directory), 0o755); err != nil {
          t.Fatal(err)
        }
      }
      if err := os.WriteFile(filepath.Join(root, "store", "main.prisma"), []byte(scenario.schema), 0o644); err != nil {
        t.Fatal(err)
      }
      if err := os.Link(filepath.Join(root, "store", "main.prisma"), filepath.Join(root, "mirror", "main.prisma")); err != nil {
        t.Skipf("this filesystem does not support hard links: %v", err)
      }
      config := decodeInventoryConfig(t, root, scenario.config)
      addresses, problems := configuredPrismaAddresses(config)
      if len(problems) != 0 || len(addresses) != 2 {
        t.Fatalf("one population must select both healthy names: %d, %v", len(addresses), problems)
      }
      inventories := map[string]*artifactInventory{}
      for _, address := range addresses {
        inventories[address.Key] = &artifactInventory{Path: address.Display, Type: artifactPrisma}
      }
      problems = prismaUnitsFromOutcome(root, distinctPrismaSources(root, addresses), inventories,
        prismaSetOutcome{Models: []prismaModel{{Name: "sale", Fields: []prismaField{{Name: "id", Symbol: "column"}}}}}, config)
      if len(problems) != 0 {
        t.Fatalf("decoded comment fan-out must be clean: %v", problems)
      }
      document, _ := scanProjectMarkdown("docs/pricing.md", "## Discounts {#discounts}\n")
      loader := newTypeScriptLoader(root, map[string]*artifactInventory{})
      states, problems := materializeClaimStates(config,
        map[string]*artifactInventory{"docs/pricing.md": document}, inventories,
        map[string]*artifactInventory{}, map[string]*artifactInventory{}, loader)
      if len(states) != 1 || len(states[0].Hosts) != 1 || len(states[0].Declarations) != 1 ||
        len(states[0].References) != 1 || len(states[0].References[0].Units) != 1 {
        t.Fatalf("aliases must retain exactly one host, tag and obligation: %#v", states)
      }
      assertNoProblems(t, append(problems, evaluateEvidenceGraph(states, loader)...))
    })
  }
}
