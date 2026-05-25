package linthost

import "testing"

// TestLSPCodeActionsRejectMoreSpecificContextOnly verifies source action
// filtering does not broaden a client request.
//
// LSP `context.only` is a prefix filter from broad to narrow. A client asking
// for `source.fixAll.ttsc.extra` did not ask for the broader
// `source.fixAll.ttsc` action, so @ttsc/lint must not expose a whole-file edit
// under a more specific request.
//
// 1. Build a context.only payload for a kind below @ttsc/lint's fix-all kind.
// 2. Ask whether `source.fixAll.ttsc` is accepted.
// 3. Assert the broader action is rejected.
func TestLSPCodeActionsRejectMoreSpecificContextOnly(t *testing.T) {
  if acceptsActionKind(`{"only":["source.fixAll.ttsc.extra"]}`, "source.fixAll.ttsc") {
    t.Fatal("broader source.fixAll.ttsc action was accepted for a more specific request")
  }
}
