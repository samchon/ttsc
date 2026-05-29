// unicorn/prefer-regexp-test: `if ("abc".match(/a/))` and
// `if (/a/.exec("abc"))` use match-array / null returns to encode a
// boolean question. `RegExp#test()` returns a boolean directly, avoids
// allocating the match result, and reads exactly like the question
// being asked.
//
// AST-only and parent-driven: visit each `CallExpression` whose callee
// is `PropertyAccess(_, match|exec)`, then confirm the call sits in a
// boolean position — the condition slot of `if`/`?:`, the operand of a
// unary `!`, or one of the short-circuit binary operators `&&`, `||`,
// `??`. Matches that aren't in a boolean position may still use the
// returned array, so they're out of scope.
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
  if !unicornPreferRegexpTestInBooleanPosition(node) {
    return
  }
  ctx.Report(node, "Prefer `RegExp#test()` over `String#match()` / `RegExp#exec()` in a boolean context.")
}

// unicornPreferRegexpTestInBooleanPosition reports whether `node` sits in
// a position that consumes only its truthiness: the condition of an
// `if` / ternary, the operand of `!`, or one side of `&&` / `||` / `??`.
func unicornPreferRegexpTestInBooleanPosition(node *shimast.Node) bool {
  parent := node.Parent
  if parent == nil {
    return false
  }
  switch parent.Kind {
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
      shimast.KindBarBarToken,
      shimast.KindQuestionQuestionToken:
      return true
    }
  }
  return false
}

func init() {
  Register(unicornPreferRegexpTest{})
}
