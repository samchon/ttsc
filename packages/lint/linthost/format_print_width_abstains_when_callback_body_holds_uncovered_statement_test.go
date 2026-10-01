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
// @evidence contracts/testing.md#behavioral-verification Runs format/print-width (default options) on a `new Singleton(...)` whose arrow callback body holds a multi-line `do { ... } while (ready);` statement indented eight columns, and requires zero findings.
// @evidence contracts/testing.md#independent-expectations The expected zero findings follows from the contract that the rule must abstain when a body holds a multi-line statement the printer would emit verbatim; it is an authored absence oracle, and the reflow of ordinary targets is verified by sibling tests.
// @evidence contracts/testing.md#distinguishing-cases One abstention case where the enclosing call would otherwise be re-indented around a frozen multi-line `do` statement; no counterpart with a printable statement body is included here.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls assertRuleSkipsSource, which runs the engine with the single rule on a temp-dir file; no child process, built binary or installed consumer.
func TestFormatPrintWidthAbstainsWhenCallbackBodyHoldsUncoveredStatement(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/print-width",
    "const x = new Singleton(\n  () => {\n        do {\n          start();\n        } while (ready);\n  },\n);\n",
  )
}
