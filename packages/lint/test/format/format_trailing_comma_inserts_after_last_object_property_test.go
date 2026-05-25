package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastObjectProperty verifies trailing
// commas land on multi-line object literals.
//
// Object literals are the second-most-common container after arrays and
// share the same close-brace-on-its-own-line UX expectation. Pinning this
// case alongside arrays makes sure ObjectLiteralExpression dispatch is
// wired the same way as ArrayLiteralExpression dispatch.
//
// 1. Parse a source file with one multi-line object literal.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the rewritten file contains the trailing comma.
func TestFormatTrailingCommaInsertsAfterLastObjectProperty(t *testing.T) {
  assertFixSnapshot(
    t,
    "formatTrailingComma",
    "const obj = {\n  a: 1,\n  b: 2\n};\n",
    "const obj = {\n  a: 1,\n  b: 2,\n};\n",
  )
}
