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
 * @evidence contracts/testing.md#behavioral-verification assertReportedLines inventories a file holding a documented interface with a documented member, a class with a documented method, a function, an object alias and a namespace with a documented const, and requires exactly the sorted rows ISale:2, ISale.price:4, Orders:20, Orders.state:22, Sale:8, Sale.prototype.charge:10, TSale:17, TSale.rate:17 and draw:14.
 * @evidence contracts/testing.md#independent-expectations The expected line numbers are read off the authored source text (each is the line of the declaration, not of the documentation block above it), not computed by the scanner.
 * @evidence contracts/testing.md#distinguishing-cases Each declaration form carries a block above it, the trivia that would move a line taken from a full start; the variable form is owned by the sibling variable-line entry, and the fallback branch below the identifier case is not reachable from any form here.
 * @evidence contracts/testing.md#execution-ownership TestEveryOtherFormReportsItsDeclarationLine is a Go unit entry in the native test process; assertReportedLines parses the source with the TypeScript parser and scans its inventory, with no consumer install or product host.
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
