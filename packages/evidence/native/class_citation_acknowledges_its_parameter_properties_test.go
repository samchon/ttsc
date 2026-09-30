package evidence

import (
  "testing"
)

/**
 * Verifies a citation on the class acknowledges a parameter property.
 *
 * `ParentID` is a proxy for this; the obligation is what the author actually
 * meets. The reference selects only the fields, so the class is an unselected
 * ancestor, and one citation on it has to discharge both syntaxes at once or a
 * project mixing them would be told to cite the same subject twice.
 *
 * The uncited sibling class is what keeps that checkable, and it declares its
 * field through the shorthand. A case whose whole population is the shorthand
 * would go silent when parameter properties stopped materializing, because the
 * claim would deactivate; a case mixing both syntaxes in the cited class alone
 * would stay green because the body field survived. The sibling separates the
 * two: it fixes the expected count, and it is the shorthand that has to
 * materialize for that count to be one.
 *
 *  1. Select two classes' fields, mixing both syntaxes in the cited one.
 *  2. Cite that class itself, once, from another module.
 *  3. Assert the uncited class's parameter property is the only thing reported.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the uncited class's parameter property is the only thing reported.
 * @evidence contracts/testing.md#independent-expectations `ParentID` is a proxy for this; the obligation is what the author actually meets. The reference selects only the fields, so the class is an unselected ancestor, and one citation on it has to discharge both syntaxes at once or a project mixing them would be told to cite the same subject twice. The authored scenario requires this outcome: Assert the uncited class's parameter property is the only thing reported.
 * @evidence contracts/testing.md#distinguishing-cases Select two classes' fields, mixing both syntaxes in the cited one. Cite that class itself, once, from another module. Assert the uncited class's parameter property is the only thing reported.
 * @evidence contracts/testing.md#execution-ownership TestClassCitationAcknowledgesItsParameterProperties runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestClassCitationAcknowledgesItsParameterProperties(t *testing.T) {
  assertReported(t, runIndexRule(t, map[string]string{
    "src/Sale.ts": `
export class Sale {
  readonly declared: number = 0;
  constructor(public readonly price: number) {}
}
export class Uncited {
  constructor(public readonly rate: number) {}
}
`,
    "src/ledger.ts": `
import type { Sale } from "./Sale.js";

/** @evidence {@link Sale} Records every fact this subject owns. */
export interface ILedger {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ledger.ts"],
    "symbol":"type",
    "reference":{
      "type":"typescript",
      "files":["src/Sale.ts"],
      "symbol":["property"]
    }
  }]}`), "Missing acknowledgement for 'Uncited.prototype.rate'")
}
