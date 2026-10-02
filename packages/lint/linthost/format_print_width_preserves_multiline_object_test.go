package linthost

import "testing"

// TestFormatPrintWidthPreservesMultilineObject verifies the rule leaves
// a user-written multi-line object expanded even when the flat form
// would fit the printWidth budget.
//
// Prettier's objectWrap:"preserve" default — confirmed against
// prettier@3 — treats a newline after `{` as intentional structure:
// `{\n  a: 1\n}` stays broken and never collapses to `{ a: 1 }`.
// formatPrintWidth mirrors that through objectHasNewlineAfterBrace;
// an earlier revision collapsed the object, which diverged from
// Prettier and silently destroyed the author's chosen layout. The rule
// must therefore emit no finding for an already-preserved object.
//
//  1. Default printWidth=80.
//  2. Feed `const x = {\n  a: 1,\n};\n` — multi-line, fits flat.
//  3. Assert the rule reports nothing, leaving the layout untouched.
//
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule runs on the preserves multiline object fixture and must report no findings, rejecting an unnecessary or unsafe edit rather than only comparing two formatter outputs. The owned result is: Assert the rule reports nothing, leaving the layout untouched.
// @evidence contracts/testing.md#independent-expectations The literal unchanged input and zero-finding expectation follow the preservation boundary described above, independently of printer output. This host proves abstention, while changing fixtures in sibling rule tests prove formatting correctness.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Default printWidth=80. The asserted decision is: Assert the rule reports nothing, leaving the layout untouched. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthPreservesMultilineObject is one Go unit entry through the fixture parser and rule engine; its zero-findings assertion uses no installed consumer, formatter subprocess or native build.
func TestFormatPrintWidthPreservesMultilineObject(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/print-width",
    "const x = {\n  a: 1,\n};\n",
  )
}
