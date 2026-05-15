package main

import "testing"

// TestFormatPrintWidthCollapsesMultilineShortObjectToFlat verifies the
// rule reflows a user-written multi-line object back to flat when the
// flat form fits.
//
// This is Prettier's default behavior: source layout is informative
// but not authoritative. The case pins the collapse direction so a
// user who manually broke a tiny object to `{\n  a: 1\n}` ends up
// with the canonical `{ a: 1 }` after `ttsc format`. A regression
// that anchored to "preserve user's multi-line layout" would fail.
//
//  1. Default printWidth=80.
//  2. Feed `const x = {\n  a: 1,\n};\n`.
//  3. Assert the output collapses to `const x = { a: 1 };\n`.
func TestFormatPrintWidthCollapsesMultilineShortObjectToFlat(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/print-width",
    "const x = {\n  a: 1,\n};\n",
    "const x = { a: 1 };\n",
  )
}
