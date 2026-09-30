package evidence

import (
  "testing"
)

/**
 * Verifies a citation with a target and no reason is malformed on a Prisma
 * host too.
 *
 * The reason is what a reviewer reads, so a citation without one is not a
 * weaker citation — it is an unreviewable one. The grammar is shared with the
 * other artifacts, but a Prisma doc comment reaches it through its own scan and
 * its own tag-boundary flag, which is exactly where a shared rule stops being
 * shared without anyone noticing.
 *
 *  1. Write a target with no reason on a model.
 *  2. Evaluate the declarations.
 *  3. Assert it is malformed rather than silently accepted.
 *
 * @evidence contracts/testing.md#behavioral-verification prismaDeclarationsFromComments accepts placement and checkEvidenceGraph reports a reasonless citation as malformed.
 * @evidence contracts/testing.md#independent-expectations The authored tag has no reason and the expected grammar diagnostic is literal.
 * @evidence contracts/testing.md#distinguishing-cases Placement scanning and graph validity remain separate responsibilities.
 * @evidence contracts/testing.md#execution-ownership TestPrismaCitationWithoutAReasonIsMalformed is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaCitationWithoutAReasonIsMalformed(t *testing.T) {
  inventories := map[string]*artifactInventory{
    "prisma/schema.prisma": {Path: "prisma/schema.prisma", Type: artifactPrisma},
  }
  scan := scanPrismaFile("prisma/schema.prisma", `/// @evidence docs/spec.md#amounts
model Sale {
  price Int
}
`, map[string]prismaLocation{})
  hosts := map[string]*evidenceUnit{}
  for _, unit := range prismaModelUnits(prismaModel{Name: "Sale"}) {
    unit.Path = "prisma/schema.prisma"
    hosts[joinPrismaIdentity(unit.Identity)] = unit
  }
  if problems := prismaDeclarationsFromComments(scan.Comments, hosts, prismaInventoriesByDisplay(inventories), nil); len(problems) != 0 {
    t.Fatalf("validity belongs to the graph, not the scan: %v", problems)
  }
  document, _ := scanProjectMarkdown("docs/spec.md", "## Amounts {#amounts}\n")
  loader := newTypeScriptLoader("", map[string]*artifactInventory{})
  states, problems := materializeClaimStates(
    anchoredGraph("", graphConfig{Claims: []claimSpec{{
      Type:    artifactPrisma,
      Files:   mustGlobSet(t, []string{"prisma/**/*.prisma"}),
      Symbols: symbolSet{"model": true},
      References: []referenceSpec{{
        Type:    artifactMarkdown,
        Files:   mustGlobSet(t, []string{"docs/spec.md"}),
        Symbols: symbolSet{"h2": true},
      }},
    }}}),
    map[string]*artifactInventory{"docs/spec.md": document},
    inventories,
    map[string]*artifactInventory{},
    map[string]*artifactInventory{},
    loader,
  )
  messages := append(problems, evaluateEvidenceGraph(states, loader)...)
  assertProblemContains(t, messages, "Malformed @evidence declaration at prisma/schema.prisma:1")
  // The reasonless citation must not quietly count either, or an author could
  // discharge an obligation with a target and nothing a reviewer can read.
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#amounts'")
}
