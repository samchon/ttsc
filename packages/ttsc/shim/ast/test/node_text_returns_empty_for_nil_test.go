package ast_test

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNodeTextReturnsEmptyForNil verifies NodeText returns "" for a nil node.
//
// Locks the nil-guard at the top of NodeText. The helper is a total function
// over *Node — typia's JSDoc parameter-name extractor calls it without
// checking — so a nil-deref here would be a behaviour change for every
// caller. The empty-string contract is the only signal that lets callers
// skip "no parameter name" entries cleanly.
//
// 1. Call NodeText(nil).
// 2. Assert the result is "".
func TestNodeTextReturnsEmptyForNil(t *testing.T) {
  if got := shimast.NodeText(nil); got != "" {
    t.Fatalf("NodeText(nil) = %q, want %q", got, "")
  }
}
