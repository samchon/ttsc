// unicorn/prefer-regexp-test reports match/exec calls when their result is
// consumed only for truthiness. Match arrays and null can then be replaced
// by a boolean result under the ordinary RegExp API.
//
// AST-only: if/ternary conditions and ! are boolean consumers. Parentheses
// and &&/|| chains must reach such a consumer; assignments and returns can
// retain captures. ?? distinguishes null from false and is excluded.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-regexp-test.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferRegexpTest struct{}

func (unicornPreferRegexpTest) Name() string { return "unicorn/prefer-regexp-test" }
func (unicornPreferRegexpTest) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornPreferRegexpTest) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil ||
    call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil {
    return
  }
  switch identifierText(access.Name()) {
  case "match", "exec":
  default:
    return
  }
  if !unicornExpressionHasBooleanConsumer(node) {
    return
  }
  ctx.Report(node, "Prefer `RegExp#test()` over `String#match()` / `RegExp#exec()` in a boolean context.")
}

// unicornExpressionHasBooleanConsumer reports whether `node` sits in
// a position that consumes only its truthiness: the condition of an
// `if` / ternary, the operand of `!`, or a parenthesized &&/|| chain
// ultimately consumed by one of those positions. Nullishness is not truthiness.
func unicornExpressionHasBooleanConsumer(node *shimast.Node) bool {
  parent := node.Parent
  if parent == nil {
    return false
  }
  switch parent.Kind {
  case shimast.KindParenthesizedExpression:
    return unicornExpressionHasBooleanConsumer(parent)
  case shimast.KindIfStatement:
    ifStmt := parent.AsIfStatement()
    return ifStmt != nil && ifStmt.Expression == node
  case shimast.KindConditionalExpression:
    cond := parent.AsConditionalExpression()
    return cond != nil && cond.Condition == node
  case shimast.KindPrefixUnaryExpression:
    pre := parent.AsPrefixUnaryExpression()
    return pre != nil && pre.Operator == shimast.KindExclamationToken
  case shimast.KindBinaryExpression:
    bin := parent.AsBinaryExpression()
    if bin == nil || bin.OperatorToken == nil {
      return false
    }
    switch bin.OperatorToken.Kind {
    case shimast.KindAmpersandAmpersandToken,
      shimast.KindBarBarToken:
      return unicornExpressionHasBooleanConsumer(parent)
    }
  }
  return false
}

func init() {
  Register(unicornPreferRegexpTest{})
}
