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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a claim over src/ledger.ts and a TypeScript reference over src/Sale.ts selecting only `property`, where `Sale` has a body field and a constructor parameter property and `Uncited` has one parameter property, with ILedger citing `{@link Sale}`; assertReported requires exactly one diagnostic, `Missing acknowledgement for 'Uncited.prototype.rate'`.
 * @evidence contracts/testing.md#independent-expectations The expected single diagnostic is authored from the scope contract: one citation on the class discharges both its field syntaxes, so only the uncited class's parameter property remains owed.
 * @evidence contracts/testing.md#distinguishing-cases The uncited sibling declares its field only through the shorthand, so the exactly-one result fails if parameter properties stop materializing (the claim would be silent) or if the cited class's shorthand were left owing (a second diagnostic).
 * @evidence contracts/testing.md#execution-ownership TestClassCitationAcknowledgesItsParameterProperties is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
