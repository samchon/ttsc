package evidence

import (
  "testing"
)

/**
 * Verifies every TypeScript selector as a graph source: types, callables, and
 * properties each create an acknowledgement obligation, while a selected type
 * scope covers its property descendants.
 *
 * Inventory inspection alone cannot prove that source filtering preserves all
 * three kinds. This complete graph acknowledges the exact targets after the
 * configured symbol union is applied, and a module-level property is cited by
 * link so that resolving it proves the property kind survived the union.
 *
 *  1. Select `"type"`, `"function"`, and `"property"` from one source file.
 *  2. Acknowledge the interface scope, the arrow function, and the module-level
 *     property by link, and assert the graph is clean.
 *  3. Drop the property citation and assert that property alone is owed.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs graphRule.Check with a TypeScript reference selecting type, function and property; the ledger cites Shape, draw and version and the graph must produce no diagnostic, so all three links resolve under the symbol union. Removing only the version citation must report exactly one missing acknowledgement, for version.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the contract that a source symbol union admits every listed kind: Shape (type), draw (callable const) and version (module-level property) are addressable, and the cited Shape also discharges its width descendant. The uncited version is owed because it is a selected property unit outside any cited scope.
 * @evidence contracts/testing.md#distinguishing-cases The fully cited ledger is the positive case and the same ledger without the version citation is the negative twin that differs in one link, so a union that dropped the property selector fails both arms.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptSourceAcceptsEverySymbolKind runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptSourceAcceptsEverySymbolKind(t *testing.T) {
  contracts := `
export interface Shape {
  width: number;
}
export const draw = (): void => {};
export const version = 1;
`
  ledger := func(links ...string) string {
    body := ""
    for _, link := range links {
      body += " * @evidence {@link " + link + "} The " + link + " unit is documented.\n"
    }
    return "import type { Shape, draw, version } from \"./contracts\";\n/**\n" + body + " */\nexport interface ILedger {}\n"
  }
  config := `{"claims":[{
    "type":"typescript",
    "files":["src/ledger.ts"],
    "symbol":"type",
    "reference":{"type":"typescript","files":["src/contracts.ts"],"symbol":["type","function","property"]}
  }]}`
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/contracts.ts": contracts,
    "src/ledger.ts":    ledger("Shape", "draw", "version"),
  }, config))
  assertReported(t, runIndexRule(t, map[string]string{
    "src/contracts.ts": contracts,
    "src/ledger.ts":    ledger("Shape", "draw"),
  }, config), "Missing acknowledgement for 'version'")
}
