package evidence

import (
  "testing"
)

/**
 * Verifies TypeScript type scopes: one type acknowledgement covers selected
 * property descendants even when only properties form the obligation.
 *
 * The type node is an aggregate address for its public contract. Keeping it
 * unresolvable under a property-only selector would force one tag per field and
 * defeat the hierarchy the selector exposes.
 *
 *  1. Select only two properties of one exported interface.
 *  2. Cite the unselected type ancestor once and assert both properties are
 *     acknowledged.
 *  3. Remove the citation and assert exactly the two properties are owed.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule imports Shape into a ledger, selects only its width/height properties, and requires a clean graph after citing Shape; with the citation removed, exactly two missing acknowledgements, for Shape.width and Shape.height, must be reported.
 * @evidence contracts/testing.md#independent-expectations An unselected type remains an aggregate address for its selected public properties.
 * @evidence contracts/testing.md#distinguishing-cases With only the type Shape cited and the selector restricted to property, the width and height obligations must be discharged and Shape itself must resolve despite being unselected. The same ledger without the citation owes exactly those two properties, so the clean result is not an inactive claim.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptTypeAcknowledgementCoversSelectedProperties is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestTypeScriptTypeAcknowledgementCoversSelectedProperties(t *testing.T) {
  contracts := `
export interface Shape {
  width: number;
  height: number;
}
`
  config := `{"claims":[{
    "type":"typescript",
    "files":["src/ledger.ts"],
    "symbol":"type",
    "reference":{"type":"typescript","files":["src/contracts.ts"],"symbol":"property"}
  }]}`
  cited := runIndexRule(t, map[string]string{
    "src/contracts.ts": contracts,
    "src/ledger.ts": `import type { Shape } from "./contracts";
/** @evidence {@link Shape} The complete shape contract is documented. */
export interface ILedger {}
`,
  }, config)
  assertNoProblems(t, cited)
  uncited := runIndexRule(t, map[string]string{
    "src/contracts.ts": contracts,
    "src/ledger.ts":    "export interface ILedger {}\n",
  }, config)
  if count := countProblemsContaining(uncited, "Missing acknowledgement"); count != 2 {
    t.Fatalf("expected the two uncited properties to be owed, got %d: %v", count, uncited)
  }
  assertProblemContains(t, uncited, "Missing acknowledgement for 'Shape.width'")
  assertProblemContains(t, uncited, "Missing acknowledgement for 'Shape.height'")
}
