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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule over src/spec/rates.ts (`alpha = 1,` then a documented `beta = 2;`) and a claim file citing only alpha through a TypeScript reference with symbol property; assertReported requires exactly one diagnostic, containing `'beta' at src/spec/rates.ts:3`.
 * @evidence contracts/testing.md#independent-expectations Line 3 is where `beta = 2;` sits in the authored fixture, so the expected location is read off the source text rather than from unit.Line; the diagnostic message is the surface an author acts on.
 * @evidence contracts/testing.md#distinguishing-cases The cited alpha declarator starts at line 1 and the uncited beta at line 3 of the same statement, so a diagnostic carrying the statement's first line would fail; the exactly-one check also shows alpha is not reported. Other declaration forms are not covered here.
 * @evidence contracts/testing.md#execution-ownership TestADiagnosticNamesTheDeclaratorsOwnLine is a Go unit entry in the native test process; runIndexRule writes the fixture to a temp directory, parses it and calls the graph rule directly, with no consumer install or product host.
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
