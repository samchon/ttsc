package linthost

import "testing"

// TestFormatPrintWidthBreaksLongNewExpressionArguments verifies the
// rule reflows `new Foo(a, b, c)` when the flat form overflows.
//
// NewExpression travels a sibling-but-distinct path through the
// dispatcher from CallExpression: it prepends `new ` and has an
// optional argument list. A regression in the keyword glue or in the
// optional-arg handling would only show up at this exact site. The
// case asserts both the keyword survives and the arguments break.
//
//  1. Configure printWidth=20.
//  2. Feed `new Foo(aaaaaa, bbbbbb, cccccc);`.
//  3. Assert the rewrite keeps `new Foo(` on the head line and breaks
//     the arguments onto indented lines with trailing comma.
func TestFormatPrintWidthBreaksLongNewExpressionArguments(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "formatPrintWidth",
    "new Foo(aaaaaa, bbbbbb, cccccc);\n",
    `{"printWidth": 20}`,
    "new Foo(\n  aaaaaa,\n  bbbbbb,\n  cccccc,\n);\n",
  )
}
