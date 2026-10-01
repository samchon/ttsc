package evidence

import (
  "testing"
)

/**
 * Verifies every TypeScript selector as a graph source: types, callables, and
 * qualified properties each create an acknowledgement obligation, while a
 * selected type scope covers its property descendants.
 *
 * Inventory inspection alone cannot prove that source filtering preserves all
 * three kinds. This complete graph acknowledges the exact targets after the
 * configured symbol union is applied.
 *
 *  1. Select `"type"`, `"function"`, and `"property"` from one source file.
 *  2. Acknowledge the interface scope and arrow-function identity by link.
 *  3. Assert the source selector materializes all three kinds.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs graphRule.Check with a TypeScript reference selecting type, function and property; the ledger cites Shape and draw, and the graph must produce no diagnostic, so both links resolve under the symbol union. Only the type and function selectors are exercised by a link that must resolve; "property" is accepted in the union but no property is cited or counted.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the contract that a source symbol union admits every listed kind: Shape (type) and draw (callable const) are addressable and the cited Shape also discharges its width descendant. Silence cannot show that a property unit was materialized or that an uncited property would be demanded.
 * @evidence contracts/testing.md#distinguishing-cases The only case is the positive one in which a type and a callable are cited together; no uncited sibling, unselected kind or negative case is run, so an implementation that dropped the property selector would still pass.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptSourceAcceptsEverySymbolKind is a Go unit entry; runIndexRule writes the two TypeScript fixtures to a temp root, parses them and calls graphRule.Check in-process without a consumer install or product host.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptSourceAcceptsEverySymbolKind runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptSourceAcceptsEverySymbolKind(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/contracts.ts": `
export interface Shape {
  width: number;
}
export const draw = (): void => {};
`,
    "src/ledger.ts": `import type { Shape, draw } from "./contracts";

/**
 * @evidence {@link Shape} The interface is documented.
 * @evidence {@link draw} The callable is documented.
 */
export interface ILedger {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ledger.ts"],
    "symbol":"type",
    "reference":{"type":"typescript","files":["src/contracts.ts"],"symbol":["type","function","property"]}
  }]}`)
  assertNoProblems(t, messages)
}
