package evidence

import (
  "sort"
  "strings"
  "testing"
)

// reportedLines lists every unit of one file as `target:line`, sorted, which is
// the whole answer rather than the one row a case is about. A position rule
// that fixes one form by moving another is a repair only for the form it was
// written against.
func reportedLines(t *testing.T, content string) []string {
  t.Helper()
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", content)
  rows := []string{}
  for _, unit := range inventory.Units {
    rows = append(rows, unit.Target+":"+decimal(unit.Line))
  }
  sort.Strings(rows)
  return rows
}

func assertReportedLines(t *testing.T, content string, want []string) {
  t.Helper()
  rows := reportedLines(t, content)
  if strings.Join(rows, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "reported lines:\n%s\nwant:\n%s",
      strings.Join(rows, "\n"),
      strings.Join(want, "\n"),
    )
  }
}

/**
 * Verifies a variable declared after trivia reports its own line.
 *
 * A unit's line is taken from a position inside the declaration's own name, and
 * a variable unit is the one kind created from a bare binding identifier. An
 * identifier reports no name of its own, so it fell through to its full start —
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

/**
 * Verifies every other declaration form reports what it reported before.
 *
 * A variable is the only kind created from a bare identifier, so every other
 * form already answered from its own name and has to be pinned as unchanged.
 * Each one here carries a documentation block, which is the trivia that would
 * move an answer taken from a full start, so a repair that widened past
 * identifiers would show up as a line pointing at a comment.
 *
 *  1. Declare each form with a block above it.
 *  2. Collect the file.
 *  3. Assert every unit names its declaration's line, not its block's.
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
