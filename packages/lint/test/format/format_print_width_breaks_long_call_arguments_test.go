package linthost

import "testing"

// TestFormatPrintWidthBreaksLongCallArguments verifies the rule reflows
// a long call expression by placing each argument on its own line.
//
// Call expressions exercise a different path through the dispatcher
// than object literals: the printer first emits the callee verbatim
// and then defers to the shared list printer for arguments. A
// regression in that glue would either lose the callee, duplicate it,
// or produce a malformed paren pair.
//
//  1. Configure printWidth=24.
//  2. Feed `process(aaaaaa, bbbbbb, cccccc);`.
//  3. Assert each argument occupies its own indented line with a
//     trailing comma after the last.
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule parses the breaks long call arguments fixture and applies its edit; complete authored output equality rejects lost source content or punctuation alongside incorrect line layout. The owned result is: Assert each argument occupies its own indented line with a trailing comma after the last.
// @evidence contracts/testing.md#independent-expectations The source operands and literal expected layout are authored independently of the rule printer. The fixture fixes printWidth and indentation, so expected line placement does not come from rendering the implementation under test.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Configure printWidth=24. The asserted decision is: Assert each argument occupies its own indented line with a trailing comma after the last. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthBreaksLongCallArguments is one Go unit entry through the registered rule engine, parser and fix applier; it uses no installed consumer or child product host.
func TestFormatPrintWidthBreaksLongCallArguments(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "process(aaaaaa, bbbbbb, cccccc);\n",
    `{"printWidth": 24}`,
    "process(\n  aaaaaa,\n  bbbbbb,\n  cccccc,\n);\n",
  )
}
