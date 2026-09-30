package evidence

import (
  "testing"
)

/**
 * Verifies ancestor-only resolution avoids unrelated same-target ambiguity.
 *
 * TypeScript permits type and value declarations with the same public name.
 * A property-only reference needs the owning type as a scope, but an unrelated
 * callable of the same spelling is neither selected nor an ancestor.
 *
 *  1. Materialize an interface and function named `Shared`.
 *  2. Select only the interface property and cite `Shared`.
 *  3. Assert the ancestor resolves without the function becoming a candidate.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule cites Shared with a property-only reference over same-named interface and function declarations; the graph must be clean.
 * @evidence contracts/testing.md#independent-expectations Only the owning interface is a relevant ancestor of Shared.value; the unrelated function must not become an ambiguity candidate.
 * @evidence contracts/testing.md#distinguishing-cases Same target spelling across type/value kinds challenges resolution filtering; this case does not independently count the selected property.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptAncestorResolutionIgnoresUnrelatedSameTargetKinds is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestTypeScriptAncestorResolutionIgnoresUnrelatedSameTargetKinds(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/contracts.ts": `
export interface Shared {
  value: string;
}
export function Shared(): void {}
`,
    "src/ledger.ts": `import type { Shared } from "./contracts";

/** @evidence {@link Shared} The type contract is documented as one scope. */
export interface ILedger {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ledger.ts"],
    "symbol":"type",
    "reference":{"type":"typescript","files":["src/contracts.ts"],"symbol":"property"}
  }]}`)
  assertNoProblems(t, messages)
}
