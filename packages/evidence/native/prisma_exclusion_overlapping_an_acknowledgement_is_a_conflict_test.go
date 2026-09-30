package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies an exclusion overlapping an acknowledgement is one conflict, not a
 * silent override.
 *
 * `@evidence` and `@evidenceExclude` on one target are a contradiction the
 * author has to resolve: the schema both uses a section and declares it
 * deliberately unused. Letting the later one win would erase the contradiction
 * and record a reviewed decision nobody made. One diagnostic rather than one
 * per descendant is the same rule the hierarchy already follows.
 *
 *  1. Cite a section from a model and exclude the same section from another.
 *  2. Evaluate the graph.
 *  3. Assert exactly one conflict diagnostic naming the target.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification checkEvidenceGraph reports exactly one acknowledgement/exclusion conflict.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Authored contradictory tags cover the same literal requirement.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Both declarations remain visible instead of one silently replacing the other.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaExclusionOverlappingAnAcknowledgementIsAConflict is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaExclusionOverlappingAnAcknowledgementIsAConflict(t *testing.T) {
  inventories := map[string]*artifactInventory{
    "prisma/schema.prisma": {Path: "prisma/schema.prisma", Type: artifactPrisma},
  }
  scan := scanPrismaFile("prisma/schema.prisma", `/// @evidence docs/spec.md#amounts The sale stores the amount.
model Sale {
  price Int
}

/// @evidenceExclude docs/spec.md#amounts The seller deliberately does not.
model Seller {
  id String
}
`, map[string]prismaLocation{})
  hosts := map[string]*evidenceUnit{}
  for _, model := range []prismaModel{{Name: "Sale"}, {Name: "Seller"}} {
    for _, unit := range prismaModelUnits(model) {
      unit.Path = "prisma/schema.prisma"
      hosts[joinPrismaIdentity(unit.Identity)] = unit
    }
  }
  if problems := prismaDeclarationsFromComments(scan.Comments, hosts, prismaInventoriesByDisplay(inventories), nil); len(problems) != 0 {
    t.Fatalf("the contradiction belongs to the graph, not the scan: %v", problems)
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
  if got := countProblemsContaining(messages, "Conflicting acknowledgements"); got != 1 {
    t.Fatalf("expected exactly one conflict diagnostic, got %d:\n%s", got, strings.Join(problemMessages(messages), "\n"))
  }
  assertProblemContains(t, messages, "docs/spec.md#amounts")
}
