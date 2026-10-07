package evidence

import (
  "testing"
)

/**
 * Verifies no TypeScript unit is offered as its own entry.
 *
 * TypeScript's language service already lists exactly the symbols in scope at
 * the cursor. A corpus built once per Program cannot know that scope, so an
 * entry per symbol would duplicate a correct list with a worse one — and would
 * survive as a stale suggestion after the symbol moved.
 *
 *  1. Satisfy a graph citing a real exported type.
 *  2. Take the published corpus.
 *  3. Assert no hint inserts the selected type's name.
 *
 * @evidence contracts/testing.md#behavioral-verification runGraphHints evaluates a passing graph referencing ISale and verifies no returned hint inserts ISale as its own entry.
 * @evidence contracts/testing.md#independent-expectations Symbol completion belongs to the TypeScript language service; the plugin corpus should not repeat the cited symbol name. This assertion forbids the literal ISale only and does not prove absence of every possible symbol or presence of the opener.
 * @evidence contracts/testing.md#distinguishing-cases The fixture selects one exported type and supplies a valid imported citation. TestHintsRouteIntoTypeScriptCompletion owns opener presence; this case owns that type name absence.
 * @evidence contracts/testing.md#execution-ownership TestHintsOfferNoTypeScriptSymbols is the Go unit entry discovered beside the native package. Its runGraphHints fixture executes Check and the simulated passing gate before Hints in the same process; it does not launch an editor, LSP host or native artifact.
 */
func TestHintsOfferNoTypeScriptSymbols(t *testing.T) {
  hints, messages := runGraphHints(t, map[string]string{
    "src/ledger.ts": hintsSatisfiedLedger,
    "src/sale.ts":   "export interface ISale {\n  price: number;\n}\n",
  }, hintsTypeScriptConfig)
  assertSilent(t, messages)
  for _, hint := range hints {
    if hint.Insert == "ISale" {
      t.Fatal("a TypeScript symbol must not be offered as its own entry")
    }
  }
}
