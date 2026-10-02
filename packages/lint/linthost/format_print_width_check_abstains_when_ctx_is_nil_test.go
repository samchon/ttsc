package linthost

import "testing"

// TestFormatPrintWidthCheckAbstainsWhenCtxIsNil verifies the Check method
// returns immediately without panicking when ctx is nil.
//
// Locks the nil-guard at the top of Check. The rule is invoked by the engine
// dispatch loop which guarantees a non-nil context, but the guard exists as a
// safety net for callers that invoke Check directly (tests, future tooling).
// Without the guard a nil-pointer dereference would crash the process.
//
//  1. Call Check directly with a nil *Context.
//  2. Assert the call returns without panicking.
//
// @evidence contracts/testing.md#behavioral-verification formatPrintWidth.Check must safely return when its Context is absent rather than attempting AST or source access.
// @evidence contracts/testing.md#independent-expectations The direct-call safety contract admits a nil Context; normal return is the observable oracle because there is no context or collector to receive findings.
// @evidence contracts/testing.md#distinguishing-cases This missing-context guard complements real-context nil-node and invalid-source-range checks; only the nil/nil input executes here and no finding-count assertion is claimed.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthCheckAbstainsWhenCtxIsNil is selected as a public Go unit by the lint semantic-unit Evidence claim; its local cases call the owning operation in the shared process without a consumer install, native artifact build or product host.
func TestFormatPrintWidthCheckAbstainsWhenCtxIsNil(t *testing.T) {
  var rule formatPrintWidth
  // Must not panic — the nil guard returns immediately.
  rule.Check(nil, nil)
}
