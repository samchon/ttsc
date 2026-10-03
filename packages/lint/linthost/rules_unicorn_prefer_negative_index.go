// unicorn/prefer-negative-index prefers a tail-relative spelling for the first
// index argument of slice/splice/toSpliced/at. The length must belong to the same
// structural receiver; repeated calls are excluded. lastIndexOf's first argument
// is a search value, so it is not an index candidate.
//
// This is report-only style advice under ordinary built-in method semantics.
// When N exceeds the receiver length, length - N and -N can select different
// positions. Authors must check their intended bounds; the AST rule does not
// establish array length or promise equivalent results for every positive N.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-negative-index.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferNegativeIndex struct{}

func (unicornPreferNegativeIndex) Name() string { return "unicorn/prefer-negative-index" }
func (unicornPreferNegativeIndex) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornPreferNegativeIndex) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil {
    return
  }
  if call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil {
    return
  }
  switch identifierText(access.Name()) {
  case "slice", "splice", "toSpliced", "at":
  default:
    return
  }
  if call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
    return
  }
  first := stripParens(call.Arguments.Nodes[0])
  if first == nil || first.Kind != shimast.KindBinaryExpression {
    return
  }
  bin := first.AsBinaryExpression()
  if bin == nil || bin.OperatorToken == nil ||
    bin.OperatorToken.Kind != shimast.KindMinusToken {
    return
  }
  left := stripParens(bin.Left)
  if left == nil || left.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  prop := left.AsPropertyAccessExpression()
  if prop == nil || identifierText(prop.Name()) != "length" {
    return
  }
  if !sameReferenceExpression(prop.Expression, access.Expression) {
    return
  }
  right := stripParens(bin.Right)
  if right == nil || right.Kind != shimast.KindNumericLiteral {
    return
  }
  if !unicornPreferAtIsPositiveInteger(numericLiteralText(right)) {
    return
  }
  ctx.Report(first, "Use a negative index (`-N`) instead of `arr.length - N`.")
}

func init() {
  Register(unicornPreferNegativeIndex{})
}
