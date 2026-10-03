package evidence

import (
  "encoding/json"
  "strings"
  "testing"
)

/**
 * Verifies decoded Prisma hosts preserve zero, shared and distinct policy counts.
 *
 * @evidence contracts/testing.md#behavioral-verification Scans each original Prisma policy fixture's comments, attaches them to literal decoded model/column units, and runs materializeClaimStates plus evaluateEvidenceGraph with the original singleEvidencePerSymbol/uniqueEvidence configuration. A silent Untagged model alone fails cardinality, two positive hosts sharing Contract fail uniqueness, and distinct Contract/Pricing citations close without diagnostics.
 * @evidence contracts/testing.md#independent-expectations Expected counts and message fragments follow the authored zero/one/two host citation counts and the reference policies. Literal decoded model names establish host identity independently of the scanner. No expected result is produced by a parser or an earlier output.
 * @evidence contracts/testing.md#distinguishing-cases Three named subtests preserve the original silent-versus-positive, shared-versus-distinct cases and all original diagnostic expectations. Full inventory insertion includes silent hosts, so dropping undocumented models cannot make the zero-cardinality case pass. Duplicate citations from one host and column/relation policy selectors remain complementary cases outside this model-only contribution.
 * @evidence contracts/testing.md#execution-ownership TestPrismaDecodedHostsPreservePolicyCounts is one selectable native Go entry with synchronous named cases. Maintained comment/Markdown scanners, decoded materialization and policy evaluation run in-process on authored strings and records. It invokes no parser bridge, fixture installation, Node child, artifact build or product host; the original cold parser bridge case remains until actual survivor execution proves migration.
 */
func TestPrismaDecodedHostsPreservePolicyCounts(t *testing.T) {
  for _, scenario := range []struct {
    name string
    document string
    schema string
    models []string
  }{
    {name: "silent-and-positive", document: "## Contract {#contract}\n", models: []string{"Untagged", "Positive"}, schema: `datasource db {
  provider = "sqlite"
}

model Untagged {
  id Int @id
}

/// @evidence docs/spec.md#contract Implements the contract.
model Positive {
  id Int @id
}
`},
    {name: "shared", document: "## Contract {#contract}\n", models: []string{"First", "Second"}, schema: `datasource db {
  provider = "sqlite"
}

/// @evidence docs/spec.md#contract First proof.
model First {
  id Int @id
}

/// @evidence docs/spec.md#contract Second proof.
model Second {
  id Int @id
}
`},
    {name: "distinct", document: "## Contract {#contract}\n\n## Pricing {#pricing}\n", models: []string{"First", "Second"}, schema: `datasource db {
  provider = "sqlite"
}

/// @evidence docs/spec.md#contract Implements the contract.
model First {
  id Int @id
}

/// @evidence docs/spec.md#pricing Implements the pricing rule.
model Second {
  id Int @id
}
`},
  } {
    t.Run(scenario.name, func(t *testing.T) {
      inventory := &artifactInventory{Path: "prisma/schema.prisma", Type: artifactPrisma}
      inventories := map[string]*artifactInventory{"prisma/schema.prisma": inventory}
      hosts := map[string]*evidenceUnit{}
      for _, name := range scenario.models {
        for _, unit := range prismaModelUnits(prismaModel{
          Name: name, Fields: []prismaField{{Name: "id", Symbol: "column"}},
        }) {
          unit.Path = inventory.Path
          inventory.Units = append(inventory.Units, unit)
          hosts[joinPrismaIdentity(unit.Identity)] = unit
        }
      }
      scan := scanPrismaFile(inventory.Path, scenario.schema, map[string]prismaLocation{})
      if problems := prismaDeclarationsFromComments(scan.Comments, hosts, prismaInventoriesByDisplay(inventories), nil); len(problems) != 0 {
        t.Fatalf("comment attachment must be clean before policy evaluation: %v", problems)
      }
      config, configProblems := decodeGraphConfig(json.RawMessage(prismaClaimReferencePolicyConfig))
      if len(configProblems) != 0 {
        t.Fatalf("policy configuration must decode: %v", configProblems)
      }
      document, _ := scanProjectMarkdown("docs/spec.md", scenario.document)
      loader := newTypeScriptLoader("", map[string]*artifactInventory{})
      states, problems := materializeClaimStates(anchoredGraph("", config),
        map[string]*artifactInventory{"docs/spec.md": document}, inventories,
        map[string]*artifactInventory{}, map[string]*artifactInventory{}, loader)
      messages := append(problems, evaluateEvidenceGraph(states, loader)...)
      switch scenario.name {
      case "silent-and-positive":
        if count := countProblemsContaining(messages, "singleEvidencePerSymbol"); count != 1 {
          t.Fatalf("only the silent host must fail cardinality, got %d: %v", count, messages)
        }
        assertProblemContains(t, messages, "Prisma model 'Untagged'")
        assertProblemContains(t, messages, "cites 0 distinct selected evidence unit(s)")
        if strings.Contains(strings.Join(problemMessages(messages), "\n"), "Prisma model 'Positive'") {
          t.Fatalf("the positive host failed cardinality: %v", messages)
        }
      case "shared":
        assertProblemContains(t, messages, "has 2 distinct positive evidence host(s); uniqueEvidence allows at most 1")
      case "distinct":
        assertNoProblems(t, messages)
      }
    })
  }
}
