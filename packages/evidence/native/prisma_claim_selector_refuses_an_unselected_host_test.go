package evidence

import (
  "testing"
)

/**
 * Verifies a citation on a host kind the claim did not select is reported, and
 * does not quietly discharge the obligation.
 *
 * A claim's selector narrows where a citation may sit, and both halves of that
 * matter. Reporting the misplaced host without withholding its coverage would
 * let an author satisfy an obligation from a position the configuration
 * excluded; withholding coverage without reporting would leave them staring at
 * a missing acknowledgement they believe they wrote.
 *
 *  1. Select `model` alone on a Prisma claim.
 *  2. Cite from a column instead.
 *  3. Assert the host is reported and the obligation still stands.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification prismaDeclarationsFromComments records the tag and graph validation refuses its unselected host.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Fixture host kind differs from explicit claim selector.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Placement cannot bypass eligibility selection.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaClaimSelectorRefusesAnUnselectedHost is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaClaimSelectorRefusesAnUnselectedHost(t *testing.T) {
  inventories := map[string]*artifactInventory{
    "prisma/schema.prisma": {Path: "prisma/schema.prisma", Type: artifactPrisma},
  }
  scan := scanPrismaFile("prisma/schema.prisma", `model Sale {
  /// @evidence docs/spec.md#amounts Cited from a column.
  price Int
}
`, map[string]prismaLocation{})
  hosts := map[string]*evidenceUnit{}
  for _, unit := range prismaModelUnits(prismaModel{
    Name:   "Sale",
    Fields: []prismaField{{Name: "price", Symbol: "column"}},
  }) {
    unit.Path = "prisma/schema.prisma"
    hosts[joinPrismaIdentity(unit.Identity)] = unit
  }
  if problems := prismaDeclarationsFromComments(scan.Comments, hosts, prismaInventoriesByDisplay(inventories), nil); len(problems) != 0 {
    t.Fatalf("host eligibility belongs to the graph, not the scan: %v", problems)
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
  assertProblemContains(t, messages, "Out-of-scope @evidence host at prisma/schema.prisma:2")
  assertProblemContains(t, messages, "host kind 'column' is not selected (model)")
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#amounts'")
}
