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
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule parses the breaks long new expression arguments fixture and applies its edit; complete authored output equality rejects lost source content or punctuation alongside incorrect line layout. The owned result is: Assert the rewrite keeps `new Foo(` on the head line and breaks the arguments onto indented lines with trailing comma.
// @evidence contracts/testing.md#independent-expectations The source operands and literal expected layout are authored independently of the rule printer. The fixture fixes printWidth and indentation, so expected line placement does not come from rendering the implementation under test.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Configure printWidth=20. The asserted decision is: Assert the rewrite keeps `new Foo(` on the head line and breaks the arguments onto indented lines with trailing comma. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthBreaksLongNewExpressionArguments is one Go unit entry through the registered rule engine, parser and fix applier; it uses no installed consumer or child product host.
func TestFormatPrintWidthBreaksLongNewExpressionArguments(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "new Foo(aaaaaa, bbbbbb, cccccc);\n",
    `{"printWidth": 20}`,
    "new Foo(\n  aaaaaa,\n  bbbbbb,\n  cccccc,\n);\n",
  )
}
