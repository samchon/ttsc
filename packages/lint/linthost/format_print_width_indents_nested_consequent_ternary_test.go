package linthost

import "testing"

// TestFormatPrintWidthIndentsNestedConsequentTernary verifies a ternary
// whose CONSEQUENT is itself a conditional steps the inner rungs in by
// one level, then returns the outer alternate to the outer indent.
//
// `a ? (b ? c : d) : e` prints with the inner `? c`/`: d` at indent 4 and
// the outer `: e` back at indent 2. The recursion composes the Doc
// engine's Indent stack rather than wrapping the nested conditional in
// its own group, so the chain shares one break decision.
//
//  1. Parse an over-width consequent-nested ternary (printWidth 40).
//  2. Apply format/print-width.
//  3. Assert the inner rungs indent to 4 and the outer `: e` to 2.
//
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule parses the indents nested consequent ternary fixture and applies its edit; complete authored output equality rejects lost source content or punctuation alongside incorrect line layout. The owned result is: Assert the inner rungs indent to 4 and the outer `: e` to 2.
// @evidence contracts/testing.md#independent-expectations The source operands and literal expected layout are authored independently of the rule printer. The fixture fixes printWidth and indentation, so expected line placement does not come from rendering the implementation under test.
// @evidence contracts/testing.md#distinguishing-cases The fixture is a single-line ternary whose consequent is itself a conditional and whose flat form exceeds printWidth 40. The asserted decision is that the inner `? c` and `: d` rungs step to indent 4 while the outer `: e` returns to indent 2; the nested-alternate shape is owned by the sibling alternate-ternary test.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthIndentsNestedConsequentTernary is one Go unit entry through the registered rule engine, parser and fix applier; it uses no installed consumer or child product host.
func TestFormatPrintWidthIndentsNestedConsequentTernary(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "const r = aaaaaaaaaa ? bbbbbbbbbb ? cccccccccc : dddddddddd : eeeeeeeeee;\n",
    `{"printWidth":40,"tabWidth":2}`,
    "const r = aaaaaaaaaa\n  ? bbbbbbbbbb\n    ? cccccccccc\n    : dddddddddd\n  : eeeeeeeeee;\n",
  )
}
