package evidence

import (
  "testing"
)

/**
 * Verifies every other declaration form reports what it reported before.
 *
 * A variable is the only kind created from a bare identifier, so every other
 * form already answered from its own name and has to be pinned as unchanged.
 * Each one here carries a documentation block, which is the trivia that would
 * move an answer taken from a full start.
 *
 * What this cannot pin is the shape of the fallback below the identifier
 * branch. Every form here answers from its own name and never reaches it, and
 * no unit kind does, so widening that branch is invisible to the suite. It is
 * stated here so the gap is a known one.
 *
 *  1. Declare each form with a block above it.
 *  2. Collect the file.
 *  3. Assert every unit names its declaration's line, not its block's.
 * @evidence contracts/testing.md#behavioral-verification assertReportedLines exercises the authored fixture. Assert every unit names its declaration's line, not its block's.
 * @evidence contracts/testing.md#independent-expectations A variable is the only kind created from a bare identifier, so every other form already answered from its own name and has to be pinned as unchanged. Each one here carries a documentation block, which is the trivia that would move an answer taken from a full start. The authored scenario requires this outcome: Assert every unit names its declaration's line, not its block's.
 * @evidence contracts/testing.md#distinguishing-cases Declare each form with a block above it. Collect the file. Assert every unit names its declaration's line, not its block's.
 * @evidence contracts/testing.md#execution-ownership TestEveryOtherFormReportsItsDeclarationLine runs as a Go unit entry in the native package. assertReportedLines executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestEveryOtherFormReportsItsDeclarationLine(t *testing.T) {
  assertReportedLines(t, `/** A type. */
export interface ISale {
  /** A member. */
  price: number;
}

/** A class. */
export class Sale {
  /** A method. */
  charge(): void {}
}

/** A function. */
export function draw(): void {}

/** An alias. */
export type TSale = { rate: number };

/** A namespace. */
export namespace Orders {
  /** A namespace variable. */
  export const state = "ready";
}
`, []string{
    "ISale.price:4",
    "ISale:2",
    "Orders.state:22",
    "Orders:20",
    "Sale.prototype.charge:10",
    "Sale:8",
    "TSale.rate:17",
    "TSale:17",
    "draw:14",
  })
}
