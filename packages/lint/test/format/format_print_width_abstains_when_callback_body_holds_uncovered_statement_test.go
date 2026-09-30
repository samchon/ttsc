package linthost

import "testing"

// TestFormatPrintWidthAbstainsWhenCallbackBodyHoldsUncoveredStatement
// verifies formatPrintWidth emits no edit when a reflow target buries
// a multi-line node the dispatcher has no printer for.
//
// A statement the dispatcher has no printer for prints verbatim, and because it
// spans several source lines its interior columns are frozen at whatever the
// user wrote. Reflowing the enclosing call would re-indent everything around
// that frozen slice and produce inconsistently indented output. The coverage
// signal (`PrintNode`'s second return value) flips to false and the rule
// abstains, leaving the file byte-identical. Abstaining is always safe; a
// half-reflowed shape is corruption.
//
// The subject moved from `if` to `switch` as those printers landed. A `do`
// statement carries it now: still verbatim and still multi-line, so the case
// continues to assert the abstention contract rather than a particular gap.
//
//  1. Feed a `new` expression whose callback body holds a multi-line `do`
//     statement.
//  2. Run formatPrintWidth.
//  3. Assert the rule reports zero findings — no edit, no diagnostic.
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule runs on the abstains when callback body holds uncovered statement fixture and must report no findings, rejecting an unnecessary or unsafe edit rather than only comparing two formatter outputs. The owned result is: Assert the rule reports zero findings — no edit, no diagnostic.
// @evidence contracts/testing.md#independent-expectations The literal unchanged input and zero-finding expectation follow the preservation boundary described above, independently of printer output. This host proves abstention, while changing fixtures in sibling rule tests prove formatting correctness.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Feed a `new` expression whose callback body holds a multi-line `do` statement. The asserted decision is: Assert the rule reports zero findings — no edit, no diagnostic. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthAbstainsWhenCallbackBodyHoldsUncoveredStatement is one Go unit entry through the fixture parser and rule engine; its zero-findings assertion uses no installed consumer, formatter subprocess or native build.
func TestFormatPrintWidthAbstainsWhenCallbackBodyHoldsUncoveredStatement(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/print-width",
    "const x = new Singleton(\n  () => {\n        do {\n          start();\n        } while (ready);\n  },\n);\n",
  )
}
