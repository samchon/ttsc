// unicorn/no-useless-fallback-in-spread reports empty fallbacks in object
// spread, where null and undefined contribute no properties. Array and
// call-argument spread require iterables and keep their load-bearing fallbacks.
//
// AST-only: visit SpreadAssignment; after stripping parentheses, its operand
// must use ?? or || with an empty object or array literal on the right.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-fallback-in-spread.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoUselessFallbackInSpread struct{}

func (unicornNoUselessFallbackInSpread) Name() string {
  return "unicorn/no-useless-fallback-in-spread"
}
func (unicornNoUselessFallbackInSpread) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSpreadAssignment}
}
func (unicornNoUselessFallbackInSpread) Check(ctx *Context, node *shimast.Node) {
  var operand *shimast.Node
  switch node.Kind {
  case shimast.KindSpreadElement:
    return
  case shimast.KindSpreadAssignment:
    if spread := node.AsSpreadAssignment(); spread != nil {
      operand = spread.Expression
    }
  }
  inner := stripParens(operand)
  if inner == nil || inner.Kind != shimast.KindBinaryExpression {
    return
  }
  bin := inner.AsBinaryExpression()
  if bin == nil || bin.OperatorToken == nil {
    return
  }
  switch bin.OperatorToken.Kind {
  case shimast.KindQuestionQuestionToken, shimast.KindBarBarToken:
  default:
    return
  }
  right := stripParens(bin.Right)
  if right == nil {
    return
  }
  switch right.Kind {
  case shimast.KindObjectLiteralExpression:
    if obj := right.AsObjectLiteralExpression(); obj != nil &&
      (obj.Properties == nil || len(obj.Properties.Nodes) == 0) {
      ctx.Report(node, "Don't use a useless `?? {}` or `?? []` fallback when spreading — `...null` and `...undefined` are no-ops.")
    }
  case shimast.KindArrayLiteralExpression:
    if arr := right.AsArrayLiteralExpression(); arr != nil &&
      (arr.Elements == nil || len(arr.Elements.Nodes) == 0) {
      ctx.Report(node, "Don't use a useless `?? {}` or `?? []` fallback when spreading — `...null` and `...undefined` are no-ops.")
    }
  }
}

func init() {
  Register(unicornNoUselessFallbackInSpread{})
}
