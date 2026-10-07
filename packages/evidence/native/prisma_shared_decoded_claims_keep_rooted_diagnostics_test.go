package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies shared decoded models keep each claim's obligation and one location.
 *
 * @evidence contracts/testing.md#behavioral-verification Preserves two original rooted-hard-link scenarios through actual walk/dedup/decoded materialization and graph evaluation. The uncited sale owes exactly Installed and Source acknowledgements in two claims. An absent-target citation must report mirror/main.prisma:1 and never store/main.prisma, even when both rooted claims read it.
 * @evidence contracts/testing.md#independent-expectations Two authored claims select two independently authored document headings, so each owes its own acknowledgement. The independent missing target and sorted mirror representative require the literal canonical diagnostic location. No prior graph output supplies expected messages; the decoded sale/id DTO does not prove parser admission.
 * @evidence contracts/testing.md#distinguishing-cases Uncited shared host with distinct obligations contrasts with one unresolved citation shared by two claims. Each case preserves its original schema, document and rooted configuration. Two claim states with one host/reference unit each are required before diagnostic comparison, rejecting population loss. Intra-claim duplicate/carrier semantics belong to the separate shared-acknowledgement entry.
 * @evidence contracts/testing.md#execution-ownership TestPrismaSharedDecodedClaimsKeepRootedDiagnostics registers two synchronous named native cases. Owned t.TempDir hard-link files, the real file walk, native locator/comment materializer and graph evaluator run without Node/parser bridge/consumer/build/product host. Only actual os.Link capability failure preserves the original conditional skip; original bridge tests remain until actual survivor execution.
 */
func TestPrismaSharedDecodedClaimsKeepRootedDiagnostics(t *testing.T) {
  for _, scenario := range []struct {
    name      string
    schema    string
    documents map[string]string
    config    string
  }{
    {name: "each-claim-owes-its-reference", schema: "model sale {\n  id String @id\n}\n", documents: map[string]string{
      "docs/installed.md": "## Installed {#installed}\n",
      "docs/source.md":    "## Source {#source}\n",
    }, config: `{"claims":[
      {"type":"prisma","root":"store","files":["**/*.prisma"],"symbol":"model","reference":{"type":"markdown","files":["docs/installed.md"],"symbol":"h2"}},
      {"type":"prisma","root":"mirror","files":["**/*.prisma"],"symbol":"model","reference":{"type":"markdown","files":["docs/source.md"],"symbol":"h2"}}
    ]}`},
    {name: "canonical-citation-diagnostic", schema: "/// @evidence docs/absent.md#nothing Nothing materializes this target.\nmodel sale {\n  id String @id\n}\n", documents: map[string]string{
      "docs/pricing.md": "## Discounts {#discounts}\n",
    }, config: `{"claims":[
      {"type":"prisma","root":"store","files":["**/*.prisma"],"symbol":"model","reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}},
      {"type":"prisma","root":"mirror","files":["**/*.prisma"],"symbol":"model","reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}}
    ]}`},
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
        t.Fatalf("expected two healthy rooted addresses: %d, %v", len(addresses), problems)
      }
      inventories := map[string]*artifactInventory{}
      for _, address := range addresses {
        inventories[address.Key] = &artifactInventory{Path: address.Display, Type: artifactPrisma}
      }
      problems = prismaUnitsFromOutcome(root, distinctPrismaSources(root, addresses), inventories,
        prismaSetOutcome{Models: []prismaModel{{Name: "sale", Fields: []prismaField{{Name: "id", Symbol: "column"}}}}}, config)
      if len(problems) != 0 {
        t.Fatalf("decoded scan must attach cleanly: %v", problems)
      }
      markdown := map[string]*artifactInventory{}
      for path, text := range scenario.documents {
        markdown[path], _ = scanProjectMarkdown(path, text)
      }
      loader := newTypeScriptLoader(root, map[string]*artifactInventory{})
      states, problems := materializeClaimStates(config, markdown, inventories,
        map[string]*artifactInventory{}, map[string]*artifactInventory{}, loader)
      if len(states) != 2 {
        t.Fatalf("both claims must remain materialized: %d", len(states))
      }
      for _, state := range states {
        if len(state.Hosts) != 1 || len(state.References) != 1 || len(state.References[0].Units) != 1 {
          t.Fatalf("each claim must retain its own host and obligation: %#v", state)
        }
      }
      messages := append(problems, evaluateEvidenceGraph(states, loader)...)
      if scenario.name == "each-claim-owes-its-reference" {
        if len(messages) != 2 {
          t.Fatalf("two claims owe exactly two acknowledgements: %v", messages)
        }
        assertProblemContains(t, messages, "Missing acknowledgement for 'docs/installed.md#installed'")
        assertProblemContains(t, messages, "Missing acknowledgement for 'docs/source.md#source'")
        for _, message := range problemMessages(messages) {
          if !strings.Contains(message, "on a selected prisma host") {
            t.Fatalf("each claim must report its Prisma obligation: %s", message)
          }
        }
      } else {
        assertProblemContains(t, messages, "Unresolved evidence target 'docs/absent.md#nothing' at mirror/main.prisma:1")
        for _, message := range problemMessages(messages) {
          if strings.Contains(message, "store/main.prisma") {
            t.Fatalf("shared diagnostic must use the set's canonical spelling: %s", message)
          }
        }
      }
    })
  }
}
