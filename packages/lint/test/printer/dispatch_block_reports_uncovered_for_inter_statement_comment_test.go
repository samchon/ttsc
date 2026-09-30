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
// as `covered == false` so the formatPrintWidth rule abstains and the
// comment survives byte-identical. A regression that ignored the
// comment would delete it on the first `ttsc format` pass.
//
//  1. Parse a callback body with a `// note` comment between two
//     statements.
//  2. Dispatch the enclosing CallExpression through PrintNode.
//  3. Assert `covered` is false.
//
// @evidence contracts/testing.md#behavioral-verification PrintNode must mark a callback with a comment between a() and b() uncovered.
// @evidence contracts/testing.md#independent-expectations The authored inter-statement note has no slot in freshly joined statements, so preserving it requires abstention.
// @evidence contracts/testing.md#distinguishing-cases A comment between two statements complements the comment-only body and the covered comment-free block.
// @evidence contracts/testing.md#execution-ownership TestDispatchBlockReportsUncoveredForInterStatementComment is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
func TestDispatchBlockReportsUncoveredForInterStatementComment(t *testing.T) {
  file := parseTS(t, "run(() => {\n  a();\n  // note\n  b();\n});\n")
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  _, covered := PrintNode(ctx, node)
  if covered {
    t.Fatalf("block with inter-statement comment must be uncovered")
  }
}
