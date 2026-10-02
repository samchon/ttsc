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
// @evidence contracts/testing.md#behavioral-verification graphRule.GraphNodes is called over a hand-built Prisma corpus holding a model marked `@internal` with two fields and a surviving model with one field; the surviving model and its field must be published and none of the withdrawn model's three units may be.
// @evidence contracts/testing.md#independent-expectations A withdrawn unit is retained internally so a citation of it can be told why the target it names is not there. Publishing it would put a node in the graph for something the rule says is not part of the surface — the graph would answer a question the linter answers the other way, which is the one thing this boundary exists to prevent. The literal Prisma addresses Ledger, Ledger.amount and Ledger.sale follow the authored model and field names. Their exact three-unit presence is required before publication, and their literal absence afterward prevents an empty collector result or a shared addressing error from satisfying the negative check. Literal Sale and Sale.price expectations pin the surviving control.
// @evidence contracts/testing.md#distinguishing-cases A withdrawn model with its columns beside a surviving one, published through the filter GraphNodes applies: the three authored withdrawn addresses must exist before filtering and be absent afterward, while Sale and Sale.price remain published.
// @evidence contracts/testing.md#execution-ownership TestGraphNodesOmitAWithdrawnUnit is the selectable Go test entry; its local loops and closures remain owned by this entry. It exercises graphRule.GraphNodes over authored Prisma model DTOs within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
func TestGraphNodesOmitAWithdrawnUnit(t *testing.T) {
  withdrawn := prismaModelUnits(prismaModel{
    Name:          "Ledger",
    Documentation: "@internal Internal bookkeeping.",
    Fields: []prismaField{
      {Name: "amount", Symbol: "column"},
      {Name: "sale", Symbol: "relation"},
    },
  })
  // These literal addresses establish that the negative population exists;
  // an empty or misaddressed collector result must not make filtering vacuous.
  withdrawnTargets := map[string]bool{}
  for _, unit := range withdrawn {
    withdrawnTargets[unit.Target] = true
  }
  if len(withdrawn) != 3 || len(withdrawnTargets) != 3 {
    t.Fatalf("expected one withdrawn model and its two fields, got %v", withdrawnTargets)
  }
  for _, target := range []string{"prisma:Ledger", "prisma:Ledger.amount", "prisma:Ledger.sale"} {
    if !withdrawnTargets[target] {
      t.Fatalf("the authored withdrawn fixture did not materialize %s: %v", target, withdrawnTargets)
    }
  }

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
  for _, target := range []string{"prisma:Ledger", "prisma:Ledger.amount", "prisma:Ledger.sale"} {
    if published[target] {
      t.Fatalf("the literal withdrawn address %s was published", target)
    }
  }
}
