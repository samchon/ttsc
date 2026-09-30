package evidence

import (
  "testing"
)

/**
 * Verifies the reported line reaches an author through a diagnostic.
 *
 * `unit.Line` is a field until something prints it, and what an author acts on
 * is the location in the message. Reading it there proves the repaired position
 * survives the conversion from byte offset to line that happens after
 * collection.
 *
 *  1. Declare a two-declarator statement whose inner declarator is not cited.
 *  2. Evaluate a claim whose reference selects those declarators.
 *  3. Assert the one diagnostic names the inner declarator's own line.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the one diagnostic names the inner declarator's own line.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations `unit.Line` is a field until something prints it, and what an author acts on is the location in the message. Reading it there proves the repaired position survives the conversion from byte offset to line that happens after collection. The authored scenario requires this outcome: Assert the one diagnostic names the inner declarator's own line.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Declare a two-declarator statement whose inner declarator is not cited. Evaluate a claim whose reference selects those declarators. Assert the one diagnostic names the inner declarator's own line.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestADiagnosticNamesTheDeclaratorsOwnLine runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestADiagnosticNamesTheDeclaratorsOwnLine(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/spec/rates.ts": `export const alpha = 1,
  /** The published rate. */
  beta = 2;
`,
    "src/claim/IView.ts": `import { alpha } from "../spec/rates";

/**
 * @evidence {@link alpha} Mirrors the published floor.
 */
export interface IView {
  floor: number;
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/claim/**"],
    "symbol":"type",
    "reference":{"type":"typescript","files":["src/spec/**"],"symbol":"property"}
  }]}`)
  assertReported(t, messages, "'beta' at src/spec/rates.ts:3")
}
