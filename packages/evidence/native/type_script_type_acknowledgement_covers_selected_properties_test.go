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
 *  2. Cite the unselected type ancestor once.
 *  3. Assert both properties are acknowledged.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule imports Shape into a ledger, selects only its width/height properties, and requires a clean graph after citing Shape.
 * @evidence contracts/testing.md#independent-expectations An unselected type remains an aggregate address for its selected public properties.
 * @evidence contracts/testing.md#distinguishing-cases The property-only selector challenges ancestor removal; silence does not independently assert how many property units were materialized.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptTypeAcknowledgementCoversSelectedProperties is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestTypeScriptTypeAcknowledgementCoversSelectedProperties(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/contracts.ts": `
export interface Shape {
  width: number;
  height: number;
}
`,
    "src/ledger.ts": `import type { Shape } from "./contracts";

/** @evidence {@link Shape} The complete shape contract is documented. */
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
