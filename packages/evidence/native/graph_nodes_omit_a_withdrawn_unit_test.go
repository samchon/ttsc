package evidence

import (
  "encoding/json"
  "testing"
  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestGraphNodesOmitAWithdrawnUnit verifies the publisher drops a unit that
// named the tag it hid itself behind, and keeps its untagged siblings.
//
// A withdrawn unit is retained internally so a citation of it can be told why the
// target it names is not there. Publishing it would put a node in the graph for
// something the rule says is not part of the surface — the graph would answer a
// question the linter answers the other way, which is the one thing this
// boundary exists to prevent.
//
// The units are materialized directly rather than parsed from a schema, because
// the Prisma loader shells out to a resolvable `@ttsc/evidence` install that a
// scratch directory does not have. What is under test is the publisher's own
// filter, and that reads `Hidden`, whichever collector set it.
//
//  1. Materialize a withdrawn model with its columns, and a surviving one.
//  2. Publish both populations through the same filter GraphNodes applies.
//  3. Assert the survivors are published and nothing withdrawn is.
// @evidence .agents/skills/contracts/testing.md#behavioral-verification graphRule.GraphNodes over authored Prisma model DTOs exercises this case: TestGraphNodesOmitAWithdrawnUnit verifies the publisher drops a unit that named the tag it hid itself behind, and keeps its untagged siblings. The original assertions check assert the survivors are published and nothing withdrawn is.
// @evidence .agents/skills/contracts/testing.md#independent-expectations A withdrawn unit is retained internally so a citation of it can be told why the target it names is not there. Publishing it would put a node in the graph for something the rule says is not part of the surface — the graph would answer a question the linter answers the other way, which is the one thing this boundary exists to prevent. The authored fixture and literal assertions below pin that contract; literal Sale and Sale.price expectations independently pin the surviving model. The withdrawn-address loop uses prismaModelUnits output and therefore does not independently certify that collector's address spelling; this entry owns the publisher filter.
// @evidence .agents/skills/contracts/testing.md#distinguishing-cases Materialize a withdrawn model with its columns, and a surviving one. Publish both populations through the same filter GraphNodes applies. Assert the survivors are published and nothing withdrawn is. The assertions and inputs in this function retain its own failure identity.
// @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphNodesOmitAWithdrawnUnit is the selectable Go test entry; its local loops and closures remain owned by this entry. It exercises graphRule.GraphNodes over authored Prisma model DTOs within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
func TestGraphNodesOmitAWithdrawnUnit(t *testing.T) {
  withdrawn := prismaModelUnits(prismaModel{
    Name:          "Ledger",
    Documentation: "@internal Internal bookkeeping.",
    Fields: []prismaField{
      {Name: "amount", Symbol: "column"},
      {Name: "sale", Symbol: "relation"},
    },
  })
  surviving := prismaModelUnits(prismaModel{
    Name:   "Sale",
    Fields: []prismaField{{Name: "price", Symbol: "column"}},
  })

  // The real publisher, over a corpus built by hand. Replicating its filter
  // here would test this file's copy of the rule rather than the rule.
  config, problems := decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":{"type":"prisma","files":["prisma/**/*.prisma"],"symbol":["model","column","relation"]}
  }]}`))
  if len(problems) != 0 {
    t.Fatalf("the probe configuration did not decode: %v", problems)
  }
  resolveGraphBases(t.TempDir(), &config)

  nodes := graphRule{}.GraphNodes(&rule.GraphContext{
    Identity: rule.ProjectIdentity{PhysicalProjectRoot: t.TempDir()},
    State: &graphCycleState{Corpus: graphCorpus{
      Config: config,
      Prisma: map[string]*artifactInventory{
        "prisma/schema.prisma": {
          Address: "prisma/schema.prisma",
          Path:    "prisma/schema.prisma",
          Type:    artifactPrisma,
          Units:   append(append([]*evidenceUnit{}, withdrawn...), surviving...),
        },
      },
    }},
    Severity: rule.SeverityError,
  })

  published := map[string]bool{}
  for _, node := range nodes {
    published[node.Address] = true
  }

  for _, target := range []string{"prisma:Sale", "prisma:Sale.price"} {
    if !published[target] {
      t.Fatalf(
        "the surviving unit %s was not published; got %v",
        target,
        sortedAddresses(nodes),
      )
    }
  }
  for _, unit := range withdrawn {
    if published[unit.Target] {
      t.Fatalf(
        "the withdrawn unit %s was published; the rule says it is not part of the surface",
        unit.Target,
      )
    }
  }
}
