// unicorn/no-typeof-undefined: comparing `typeof X` against the string
// literal `"undefined"` is a leftover guard from pre-strict-mode code,
// when referencing an undeclared identifier threw a ReferenceError.
// Modern code can compare the value to `undefined` directly, which is
// shorter and reads as the intent it actually expresses.
//
// AST-only: each visited BinaryExpression is rejected when its operator
// is one of `===`, `==`, `!==`, `!=` and its two operands include
// exactly one TypeOfExpression and exactly one string-shaped literal
// (StringLiteral or NoSubstitutionTemplateLiteral) whose text value is
// `undefined`. Either side may carry the typeof; either side may carry
// the literal.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-typeof-undefined.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoTypeofUndefined struct{}

func (unicornNoTypeofUndefined) Name() string { return "unicorn/no-typeof-undefined" }
func (unicornNoTypeofUndefined) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindBinaryExpression}
}
func (unicornNoTypeofUndefined) Check(ctx *Context, node *shimast.Node) {
  expr := node.AsBinaryExpression()
  if expr == nil || expr.OperatorToken == nil {
    return
  }
  switch expr.OperatorToken.Kind {
  case shimast.KindEqualsEqualsEqualsToken,
    shimast.KindEqualsEqualsToken,
    shimast.KindExclamationEqualsEqualsToken,
    shimast.KindExclamationEqualsToken:
  default:
    return
  }
  left := stripParens(expr.Left)
  right := stripParens(expr.Right)
  if left == nil || right == nil {
    return
  }
  var literal *shimast.Node
  if left.Kind == shimast.KindTypeOfExpression {
    literal = right
  } else if right.Kind == shimast.KindTypeOfExpression {
    literal = left
  } else {
    return
  }
  if stringLiteralText(literal) != "undefined" {
    return
  }
  ctx.Report(node, "Compare with `undefined` directly instead of using `typeof`.")
}

func init() {
  Register(unicornNoTypeofUndefined{})
}
