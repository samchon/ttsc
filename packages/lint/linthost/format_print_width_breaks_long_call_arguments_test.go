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
//
// @evidence contracts/testing.md#behavioral-verification Applies format/print-width at printWidth 24 to `process(aaaaaa, bbbbbb, cccccc);` and requires the exact output with each argument on its own two-space-indented line and a trailing comma after the last.
// @evidence contracts/testing.md#independent-expectations The expected text is an authored literal for a width-24 break of three short arguments; the callee, arguments and punctuation are preserved and nothing is derived from the printer.
// @evidence contracts/testing.md#distinguishing-cases One changing case through the call-arguments path of the printer (a different path from object literals), where a lost callee, duplicated callee or malformed parentheses would change the output text; a fitting call is not included here.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls assertFixSnapshotWithOptions, applying the rule's edits to a temp-dir file; no child process, built binary or installed consumer.
func TestFormatPrintWidthBreaksLongCallArguments(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "process(aaaaaa, bbbbbb, cccccc);\n",
    `{"printWidth": 24}`,
    "process(\n  aaaaaa,\n  bbbbbb,\n  cccccc,\n);\n",
  )
}
