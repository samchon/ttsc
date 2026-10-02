package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

/**
 * Verifies decoded Prisma outcomes retain original locations or a set failure.
 *
 * @evidence contracts/testing.md#behavioral-verification prismaUnitsFromOutcome scans the unchanged prismaBridgeSchema around literal Sale/Seller decoded records and must preserve all native member kinds/paths and the original five line expectations. A separately injected rejected outcome over the original unclosed Sale schema must return a diagnostic while retaining an empty failed inventory with wildcard problems.
 * @evidence contracts/testing.md#independent-expectations The original bridge schema fixes literal line positions and authored decoded records fix model/column/relation identities. The unclosed schema's rejection is an input here, not a parser assertion; once rejected, no selectable kind may lose its set-wide failure. Literal line/kind tables and empty/failed/wildcard expectations do not derive from a loader output.
 * @evidence contracts/testing.md#distinguishing-cases Named located and rejected cases separate successful native location materialization from failed-set propagation. The complete eight-member table adds id-column controls to the original six-kind table; exactly the original five lines are certified. Every located unit must retain the original source path. Raw parser classification/rejection and JSON connection remain separate T/E responsibilities.
 * @evidence contracts/testing.md#execution-ownership TestPrismaDecodedOutcomesPreserveLocationsAndRejection is one selectable native entry with synchronous named subtests. Owned t.TempDir source files feed the actual locator/scanner and decoded materializer in-process; rejection uses the real failure owner, not a fake graph diagnostic. No Node parser/consumer/build/product host is started. Both original bridge entries remain pending actual survivor execution.
 */
func TestPrismaDecodedOutcomesPreserveLocationsAndRejection(t *testing.T) {
  for _, name := range []string{"located", "rejected"} {
    t.Run(name, func(t *testing.T) {
      root := t.TempDir()
      if err := os.MkdirAll(filepath.Join(root, "prisma"), 0o755); err != nil {
        t.Fatal(err)
      }
      schema := prismaBridgeSchema
      outcome := prismaSetOutcome{Models: []prismaModel{
        {Name: "Sale", Documentation: "A sale.", Fields: []prismaField{
          {Name: "id", Symbol: "column"}, {Name: "price", Symbol: "column"},
          {Name: "seller_id", Symbol: "column"}, {Name: "seller", Symbol: "relation"},
        }},
        {Name: "Seller", Fields: []prismaField{{Name: "id", Symbol: "column"}, {Name: "sales", Symbol: "relation"}}},
      }}
      if name == "rejected" {
        schema = "model Sale {\n  id String @id\n"
        outcome = prismaSetOutcome{Rejected: true, Problem: "The authored schema was rejected."}
      }
      if err := os.WriteFile(filepath.Join(root, "prisma", "schema.prisma"), []byte(schema), 0o644); err != nil {
        t.Fatal(err)
      }
      config := anchoredGraph(root, graphConfig{Claims: []claimSpec{{
        Type: artifactTypeScript, Files: mustGlobSet(t, []string{"src/**/*.ts"}), Symbols: symbolSet{"type": true},
        References: []referenceSpec{{Type: artifactPrisma, Files: mustGlobSet(t, []string{"prisma/**/*.prisma"}), Symbols: symbolSet{"model": true}}},
      }}})
      inventory := &artifactInventory{Path: "prisma/schema.prisma", Type: artifactPrisma}
      inventories := map[string]*artifactInventory{"prisma/schema.prisma": inventory}
      set := prismaSourceSet{Sources: []string{"prisma/schema.prisma"}, Spellings: map[string][]string{"prisma/schema.prisma": {"prisma/schema.prisma"}}}
      problems := prismaUnitsFromOutcome(root, set, inventories, outcome, config)
      if name == "rejected" {
        if len(problems) == 0 || len(inventory.Units) != 0 || !inventory.LoadFailed || len(inventory.Problems) == 0 {
          t.Fatalf("rejected set must retain an empty failed inventory and diagnostic: %#v, %v", inventory, problems)
        }
        for _, problem := range inventory.Problems {
          if problem.Symbol != "*" {
            t.Fatalf("set failure must reach every member selector: %q", problem.Symbol)
          }
        }
        return
      }
      if len(problems) != 0 || inventory.LoadFailed || len(inventory.Problems) != 0 ||
        prismaUnitIndex(inventory.Units) != "prisma:Sale=model\nprisma:Sale.id=column\nprisma:Sale.price=column\nprisma:Sale.seller=relation\nprisma:Sale.seller_id=column\nprisma:Seller=model\nprisma:Seller.id=column\nprisma:Seller.sales=relation" {
        t.Fatalf("located outcome must retain the complete healthy population: %#v, %v", inventory, problems)
      }
      located := map[string]int{}
      for _, unit := range inventory.Units {
        if unit.Path != "prisma/schema.prisma" {
          t.Errorf("%s filed under %q", unit.Target, unit.Path)
        }
        located[unit.Target] = unit.Line
      }
      for target, line := range map[string]int{
        "prisma:Sale": 6, "prisma:Sale.price": 8, "prisma:Sale.seller": 10,
        "prisma:Seller": 13, "prisma:Seller.sales": 15,
      } {
        if located[target] != line {
          t.Errorf("%s located at line %d, want %d", target, located[target], line)
        }
      }
    })
  }
}
