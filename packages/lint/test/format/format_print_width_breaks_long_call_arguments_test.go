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
func TestFormatPrintWidthBreaksLongCallArguments(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "formatPrintWidth",
    "process(aaaaaa, bbbbbb, cccccc);\n",
    `{"printWidth": 24}`,
    "process(\n  aaaaaa,\n  bbbbbb,\n  cccccc,\n);\n",
  )
}
