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
func TestFormatPrintWidthCheckAbstainsWhenCtxIsNil(t *testing.T) {
  var rule formatPrintWidth
  // Must not panic — the nil guard returns immediately.
  rule.Check(nil, nil)
}
