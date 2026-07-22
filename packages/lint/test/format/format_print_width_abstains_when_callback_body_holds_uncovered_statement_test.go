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
// The subject was an `if` statement until one gained a printer, at which point
// the case was asserting the absence of a printer rather than the abstention
// contract. A `switch` carries it now for the same reason it carries the
// dispatcher's own coverage case.
//
//  1. Feed a `new` expression whose callback body holds a multi-line
//     `switch` statement.
//  2. Run formatPrintWidth.
//  3. Assert the rule reports zero findings — no edit, no diagnostic.
func TestFormatPrintWidthAbstainsWhenCallbackBodyHoldsUncoveredStatement(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/print-width",
    "const x = new Singleton(\n  () => {\n        switch (ready) {\n          case 1:\n            start();\n        }\n  },\n);\n",
  )
}
