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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the source selector materializes all three kinds.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Inventory inspection alone cannot prove that source filtering preserves all three kinds. This complete graph acknowledges the exact targets after the configured symbol union is applied. The authored scenario requires this outcome: Assert the source selector materializes all three kinds.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Select `"type"`, `"function"`, and `"property"` from one source file. Acknowledge the interface scope and arrow-function identity by link. Assert the source selector materializes all three kinds.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestTypeScriptSourceAcceptsEverySymbolKind runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
