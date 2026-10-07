package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchBlockReportsUncoveredForInterStatementComment verifies the
// block printer reports `covered == false` when the block carries a
// comment that lives between two statements.
//
// printBlock joins statements with bare Hardline separators that have
// no carrier slot for trivia. A comment sitting between statements
// would be silently dropped by a reflow. The printer must surface that
// as `covered == false`. This test checks that flag on the enclosing
// call; it does not run formatPrintWidth or assert byte-identical disk
// output.
//
//  1. Parse a callback body with a `// note` comment between two
//     statements.
//  2. Dispatch the enclosing CallExpression through PrintNode.
//  3. Assert `covered` is false.
//
// @evidence contracts/testing.md#behavioral-verification PrintNode must mark a callback with a comment between a() and b() uncovered.
// @evidence contracts/testing.md#independent-expectations The authored inter-statement note has no slot in freshly joined statements, so preserving it requires abstention.
// @evidence contracts/testing.md#distinguishing-cases A comment between two statements complements the comment-only body and the covered comment-free block.
// @evidence contracts/testing.md#execution-ownership TestDispatchBlockReportsUncoveredForInterStatementComment is a plain top-level Go unit test, selectable with go test -run, that calls PrintNode directly on a parsed call whose callback body has a line comment between two statements inside the test process; it installs no consumer, builds no native artifact and starts no product host.
func TestDispatchBlockReportsUncoveredForInterStatementComment(t *testing.T) {
  file := parseTS(t, "run(() => {\n  a();\n  // note\n  b();\n});\n")
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  _, covered := PrintNode(ctx, node)
  if covered {
    t.Fatalf("block with inter-statement comment must be uncovered")
  }
}
