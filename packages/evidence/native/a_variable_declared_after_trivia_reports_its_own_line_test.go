package evidence

import (
  "testing"
)

/**
 * Verifies a variable declared after trivia reports its own line.
 *
 * A unit's line is taken from a position inside the declaration's own name, and
 * a variable unit is the one kind created from a bare binding identifier. An
 * identifier reports no name of its own, so it fell through to its full start ,
 * the position the previous token ended at, which is a line above for each leaf
 * of a multi-line destructuring pattern and two lines above for a declarator
 * whose documentation block sits between them.
 *
 * Those are the two shapes where a reader cannot recover the position by eye:
 * a long pattern, and the block where a citation would be written.
 *
 *  1. Declare a first declarator, an inner one carrying a block, and a
 *     multi-line pattern.
 *  2. Collect the file.
 *  3. Assert every unit names the line it is declared on.
 * @evidence contracts/testing.md#behavioral-verification assertReportedLines inventories a file holding `alpha = 1,` then a documented `beta = 2;`, then a multi-line `export const { gamma, delta } = source;`, and requires exactly the sorted rows alpha:2, beta:4, delta:7 and gamma:6.
 * @evidence contracts/testing.md#independent-expectations The expected line numbers are read off the authored source text (the line each name is written on), not computed by the scanner; the full-start position of a bare identifier would put beta two lines early and the pattern leaves one line early.
 * @evidence contracts/testing.md#distinguishing-cases A first declarator, a declarator behind a documentation block and the leaves of a multi-line pattern are the three shapes where the position before the name differs from the name's own line; the exact row list also fails if a unit is missing or extra.
 * @evidence contracts/testing.md#execution-ownership TestAVariableDeclaredAfterTriviaReportsItsOwnLine is a Go unit entry in the native test process; assertReportedLines parses the source with the TypeScript parser and scans its inventory, with no consumer install or product host.
 */
func TestAVariableDeclaredAfterTriviaReportsItsOwnLine(t *testing.T) {
  assertReportedLines(t, `declare const source: { gamma: number; delta: number };
export const alpha = 1,
  /** The published rate. */
  beta = 2;
export const {
  gamma,
  delta,
} = source;
`, []string{
    "alpha:2",
    "beta:4",
    "delta:7",
    "gamma:6",
  })
}
