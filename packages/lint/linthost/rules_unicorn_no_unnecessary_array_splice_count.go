// unicorn/no-unnecessary-array-splice-count reports exactly two-argument
// splice/toSpliced calls whose count repeats the receiver's length or Infinity.
// Ordinary array methods omit this count to select the tail. Additional insertion
// arguments and lengths belonging to another receiver remain meaningful.
//
// The shared structural reference comparator excludes repeated calls. This AST
// baseline assumes ordinary array methods and Infinity, and reports without edits.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unnecessary-array-splice-count.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoUnnecessaryArraySpliceCount struct{}

func (unicornNoUnnecessaryArraySpliceCount) Name() string {
  return "unicorn/no-unnecessary-array-splice-count"
}
func (unicornNoUnnecessaryArraySpliceCount) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornNoUnnecessaryArraySpliceCount) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil {
    return
  }
  method := identifierText(access.Name())
  if method != "splice" && method != "toSpliced" {
    return
  }
  if call.Arguments == nil || len(call.Arguments.Nodes) != 2 {
    return
  }
  second := stripParens(call.Arguments.Nodes[1])
  if !unicornUnnecessaryCountArgument(second, access.Expression) {
    return
  }
  ctx.Report(call.Arguments.Nodes[1], "Use `splice(start)` without the count — `.length` / `Infinity` is the default.")
}

// unicornUnnecessaryCountArgument matches Infinity or the same receiver's length.
// Structural reference comparison excludes effectful repeated calls.
func unicornUnnecessaryCountArgument(node, receiver *shimast.Node) bool {
  if node == nil {
    return false
  }
  if node.Kind == shimast.KindPropertyAccessExpression {
    access := node.AsPropertyAccessExpression()
    if access == nil {
      return false
    }
    return identifierText(access.Name()) == "length" && sameReferenceExpression(access.Expression, receiver)
  }
  if node.Kind == shimast.KindIdentifier {
    return identifierText(node) == "Infinity"
  }
  return false
}

func init() {
  Register(unicornNoUnnecessaryArraySpliceCount{})
}
