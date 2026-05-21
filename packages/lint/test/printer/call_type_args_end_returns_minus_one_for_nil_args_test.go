package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCallTypeArgsEndReturnsMinus1ForNilArgs verifies that callTypeArgsEnd
// returns -1 when TypeArguments is nil, and returns the end offset when no
// `>` is found scanning forward from that offset.
//
// callTypeArgsEnd is called only from inside the `if call.TypeArguments != nil`
// guard in printCallExpression, so the internal nil check is a redundant
// safety valve that existing tests never exercise. The "no > found" return
// at line 154 fires when TypeArguments.End() points to a position in source
// where no `>` character follows (e.g., a zero-value NodeList whose End()
// is 0, and source text without `>`).
//
//  1. Parse `foo(x)` to get a CallExpression whose TypeArguments is nil;
//     call callTypeArgsEnd directly and assert -1.
//  2. Inject a zero-value NodeList (End()==0) so the forward scan finds no
//     `>` in the source and falls through to return the end offset.
func TestCallTypeArgsEndReturnsMinus1ForNilArgs(t *testing.T) {
  file := parseTS(t, "foo(x);\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  call := node.AsCallExpression()

  // 1. call.TypeArguments is nil for a call without type arguments.
  if got := callTypeArgsEnd(ctx, call); got != -1 {
    t.Fatalf("callTypeArgsEnd with nil TypeArguments: want -1, got %d", got)
  }

  // 2. A zero-value NodeList has End()==0. The source "foo(x);\n" contains
  //    no `>` character, so the scan from offset 0 finds nothing and the
  //    function returns 0 (the end offset).
  zeroList := &shimast.NodeList{}
  call.TypeArguments = zeroList
  if got := callTypeArgsEnd(ctx, call); got != 0 {
    t.Fatalf("callTypeArgsEnd with no-close-bracket source: want 0 (end offset), got %d", got)
  }
}
