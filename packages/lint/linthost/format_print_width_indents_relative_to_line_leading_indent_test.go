package linthost

import "testing"

// TestFormatPrintWidthIndentsRelativeToLineLeadingIndent verifies that
// a reflowed node nested inside an indented enclosing block aligns its
// continuation lines to the *line's* leading indent, not the column
// where the node itself begins.
//
// `const x = { … }` is the canonical exhibit. The `{` lives at column
// 10 but the broken form should indent children to column 2
// (lineLeadingIndent=0 + indentUnit=2), matching Prettier's output. A
// regression that aligned children to the node's leading column would
// emit `            aa: 1,` instead of `  aa: 1,`.
//
// The case nests one level deeper to make the difference unambiguous:
// the enclosing function body indents `const x = {` to column 2, so
// the broken children should land at column 4 — *not* column 12 (the
// `{` column) and not column 0 (the file's left edge).
//
//  1. Feed a fixture where `const x = { … }` sits inside a function
//     body and the literal would overflow the printWidth.
//  2. Configure printWidth=28 so the literal must break (the literal
//     starts at column 12 and is 21 chars wide flat, total 33).
//  3. Assert the children align under column 4.
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule parses the indents relative to line leading indent fixture and applies its edit; complete authored output equality rejects lost source content or punctuation alongside incorrect line layout. The owned result is: Assert the children align under column 4.
// @evidence contracts/testing.md#independent-expectations The source operands and literal expected layout are authored independently of the rule printer. The fixture fixes printWidth and indentation, so expected line placement does not come from rendering the implementation under test.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Feed a fixture where `const x = { … }` sits inside a function body and the literal would overflow the printWidth. The asserted decision is: Assert the children align under column 4. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthIndentsRelativeToLineLeadingIndent is one Go unit entry through the registered rule engine, parser and fix applier; it uses no installed consumer or child product host.
func TestFormatPrintWidthIndentsRelativeToLineLeadingIndent(t *testing.T) {
  src := "function f() {\n  const x = { aa: 1, bb: 2, cc: 3 };\n}\n"
  want := "function f() {\n  const x = {\n    aa: 1,\n    bb: 2,\n    cc: 3,\n  };\n}\n"
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    src,
    `{"printWidth": 28}`,
    want,
  )
}
