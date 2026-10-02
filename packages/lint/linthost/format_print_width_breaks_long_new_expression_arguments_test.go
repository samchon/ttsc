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
//
// @evidence contracts/testing.md#behavioral-verification Applies format/print-width at printWidth 20 to `new Foo(aaaaaa, bbbbbb, cccccc);` and requires the exact output `new Foo(` followed by three indented arguments with a trailing comma and `);`.
// @evidence contracts/testing.md#independent-expectations The expected text is an authored literal; the `new` keyword, constructor name, arguments and punctuation are preserved and nothing is derived from the printer.
// @evidence contracts/testing.md#distinguishing-cases One changing case through the NewExpression path (keyword glue plus the argument list), the `new` counterpart of the call-arguments case; a fitting `new` call is not included here.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls assertFixSnapshotWithOptions, applying the rule's edits to a temp-dir file; no child process, built binary or installed consumer.
func TestFormatPrintWidthBreaksLongNewExpressionArguments(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "new Foo(aaaaaa, bbbbbb, cccccc);\n",
    `{"printWidth": 20}`,
    "new Foo(\n  aaaaaa,\n  bbbbbb,\n  cccccc,\n);\n",
  )
}
