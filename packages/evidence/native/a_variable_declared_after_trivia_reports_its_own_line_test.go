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
 * @evidence contracts/testing.md#behavioral-verification assertReportedLines exercises the authored fixture. Assert every unit names the line it is declared on.
 * @evidence contracts/testing.md#independent-expectations A unit's line is taken from a position inside the declaration's own name, and a variable unit is the one kind created from a bare binding identifier. An identifier reports no name of its own, so it fell through to its full start , the position the previous token ended at, which is a line above for each leaf of a multi-line destructuring pattern and two lines above for a declarator whose documentation block sits between them. The authored scenario requires this outcome: Assert every unit names the line it is declared on.
 * @evidence contracts/testing.md#distinguishing-cases Declare a first declarator, an inner one carrying a block, and a multi-line pattern. Collect the file. Assert every unit names the line it is declared on.
 * @evidence contracts/testing.md#execution-ownership TestAVariableDeclaredAfterTriviaReportsItsOwnLine runs as a Go unit entry in the native package. assertReportedLines executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
