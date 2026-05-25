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
func TestFormatPrintWidthPreservesMultilineObject(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/print-width",
    "const x = {\n  a: 1,\n};\n",
  )
}
