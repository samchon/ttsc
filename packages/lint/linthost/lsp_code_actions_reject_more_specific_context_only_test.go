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
//
// @evidence contracts/testing.md#behavioral-verification acceptsActionKind accepts broad and exact source prefixes while rejecting a deeper requested kind and an unrelated sibling.
// @evidence contracts/testing.md#independent-expectations Authored true/false prefix expectations follow the LSP directional CodeActionKind contract rather than copying action-filter output.
// @evidence contracts/testing.md#distinguishing-cases Source, source.fixAll and exact ttsc are positive controls; ttsc.extra and other distinguish reversed-prefix and sibling-prefix bugs.
// @evidence contracts/testing.md#execution-ownership The pure Go kind predicate executes directly once in the unit process with literal JSON, without project loading or a host subprocess.
func TestLSPCodeActionsRejectMoreSpecificContextOnly(t *testing.T) {
  for _, context := range []string{
    `{"only":["source"]}`,
    `{"only":["source.fixAll"]}`,
    `{"only":["source.fixAll.ttsc"]}`,
  } {
    if !acceptsActionKind(context, "source.fixAll.ttsc") {
      t.Fatalf("broader or exact request rejected the owned action: %s", context)
    }
  }
  if acceptsActionKind(`{"only":["source.fixAll.other"]}`, "source.fixAll.ttsc") {
    t.Fatal("unrelated sibling kind admitted the owned action")
  }
  if acceptsActionKind(`{"only":["source.fixAll.ttsc.extra"]}`, "source.fixAll.ttsc") {
    t.Fatal("broader source.fixAll.ttsc action was accepted for a more specific request")
  }
}
