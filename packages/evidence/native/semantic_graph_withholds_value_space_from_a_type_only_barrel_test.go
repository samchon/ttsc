package evidence

import (
  "sort"
  "testing"
)

/**
 * TestEvidenceSemanticGraphWithholdsValueSpaceFromATypeOnlyBarrel verifies a type-only barrel retains interface members and withholds class values.
 *
 * Reading obligations from the actual graph rule distinguishes a withheld value
 * population from a reference that reaches nothing. A value-export twin also
 * proves that the unchanged class member is reachable when its edge permits it.
 *
 * 1. Evaluate the original class, interface, type-only barrel and uncited ledger.
 * 2. Require exactly the class name, interface name and interface member obligations.
 * 3. Change only the barrel edge to a value export and require the class member too.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule traverses the original emitted-specifier barrel and reports actual owed targets; changing its type-only edge to a value edge admits Sale.prototype.price while preserving interface type-space.
 * @evidence contracts/testing.md#independent-expectations Literal expected populations come from the authored Sale.price and IPlain.rate declarations; the independent lists are not read from the collector or calculated by the product projection.
 * @evidence contracts/testing.md#distinguishing-cases The original type-only reference remains active because IPlain.rate must be owed, with Sale.prototype.price absent; the adjacent value-export twin must owe that same class member, preventing a blanket member-suppression implementation from passing.
 * @evidence contracts/testing.md#execution-ownership This named TestEvidenceSemantic source unit runs the authored parser and graph rule through `go test` in the native package in one process; independent named type-only and value-export subcases preserve both observations after failure, while native compiler exit-status and packaged diagnostic transport remain separate consumer boundary responsibilities.
 */
func TestEvidenceSemanticGraphWithholdsValueSpaceFromATypeOnlyBarrel(t *testing.T) {
  files := map[string]string{
    "src/sale.ts":   "/** A sale offered to a customer. */\nexport class Sale {\n  /** The amount the customer pays. */\n  public readonly price: number = 0;\n}\n\n/** A plain contract no class merges with. */\nexport interface IPlain {\n  /** The rate this contract fixes. */\n  rate: number;\n}\n",
    "src/index.ts":  "export type { Sale, IPlain } from \"./sale.js\";\n",
    "src/ledger.ts": "/** This claim cites nothing, so the population reports itself. */\nexport interface ILedger {}\n",
  }
  config := `{"claims":[{"type":"typescript","files":["src/ledger.ts"],"symbol":"type","reference":{"type":"typescript","files":["src/index.ts"],"symbol":["type","function","property"]}}]}`
  for index, scenario := range []struct {
    barrel string
    want   []string
  }{
    {"export type { Sale, IPlain } from \"./sale.js\";\n", []string{"IPlain", "IPlain.rate", "Sale"}},
    {"export { Sale, IPlain } from \"./sale.js\";\n", []string{"IPlain", "IPlain.rate", "Sale", "Sale.prototype.price"}},
  } {
    t.Run([]string{"type_only", "value_export"}[index], func(t *testing.T) {
      files["src/index.ts"] = scenario.barrel
      messages := runIndexRule(t, files, config)
      got := make([]string, 0, len(messages))
      for _, message := range messages {
        match := missingAcknowledgement.FindStringSubmatch(message)
        if match == nil {
          t.Fatalf("unexpected non-obligation diagnostic: %s", message)
        }
        got = append(got, match[1])
      }
      sort.Strings(got)
      if len(got) != len(scenario.want) {
        t.Fatalf("barrel %q obligations %v, want %v", scenario.barrel, got, scenario.want)
      }
      for i := range got {
        if got[i] != scenario.want[i] {
          t.Fatalf("barrel %q obligations %v, want %v", scenario.barrel, got, scenario.want)
        }
      }
    })
  }
}
