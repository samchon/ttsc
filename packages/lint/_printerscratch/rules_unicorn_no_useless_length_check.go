// unicorn/no-useless-length-check reports a repeated array receiver's
// length > 0 or length != 0 guard before some/forEach. With ordinary array
// methods, some already yields false for empty input. For forEach, false and
// undefined differ as values, so the guard is redundant only when the result
// is discarded or consumed for truthiness. Every/map/filter are excluded.
//
// AST-only: matching receiver text identifies the intended array idiom;
// this rule does not prove that custom methods or getters have array semantics.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-length-check.md
package linthost

import (
  "fmt"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

var unicornNoUselessLengthCheckMethods = map[string]struct{}{
  "some":    {},
  "forEach": {},
}

type unicornNoUselessLengthCheck struct{}

func (unicornNoUselessLengthCheck) Name() string { return "unicorn/no-useless-length-check" }
func (unicornNoUselessLengthCheck) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindBinaryExpression}
}
func (unicornNoUselessLengthCheck) Check(ctx *Context, node *shimast.Node) {
  bin := node.AsBinaryExpression()
  if bin == nil || bin.OperatorToken == nil ||
    bin.OperatorToken.Kind != shimast.KindAmpersandAmpersandToken {
    return
  }
  left := stripParens(bin.Left)
  right := stripParens(bin.Right)
  if left == nil || right == nil {
    return
  }
  lengthReceiver := unicornUselessLengthCheckLHSReceiver(ctx, left)
  if lengthReceiver == "" {
    return
  }
  method, callReceiver := unicornUselessLengthCheckRHSReceiver(ctx, right)
  if method == "" || callReceiver == "" {
    return
  }
  if lengthReceiver != callReceiver {
    return
  }
  if method == "forEach" && !unicornExpressionHasBooleanConsumer(node) && !unicornLengthCheckResultIsDiscarded(node) {
    return
  }
  ctx.Report(node, fmt.Sprintf("Useless `.length` check — `%s` already handles empty arrays correctly.", method))
}

// unicornLengthCheckResultIsDiscarded follows parentheses to an expression
// statement; assignments, returns and arguments retain the false/undefined value.
func unicornLengthCheckResultIsDiscarded(node *shimast.Node) bool {
  for node.Parent != nil && node.Parent.Kind == shimast.KindParenthesizedExpression {
    node = node.Parent
  }
  return node.Parent != nil && node.Parent.Kind == shimast.KindExpressionStatement
}

// unicornUselessLengthCheckLHSReceiver returns the textual form of `X`
// when `node` is `X.length > 0` or `X.length !== 0` (either operand
// order); returns "" otherwise.
func unicornUselessLengthCheckLHSReceiver(ctx *Context, node *shimast.Node) string {
  bin := node.AsBinaryExpression()
  if bin == nil || bin.OperatorToken == nil || bin.Left == nil || bin.Right == nil {
    return ""
  }
  op := bin.OperatorToken.Kind
  if op != shimast.KindGreaterThanToken &&
    op != shimast.KindExclamationEqualsEqualsToken &&
    op != shimast.KindExclamationEqualsToken {
    return ""
  }
  lhs := stripParens(bin.Left)
  rhs := stripParens(bin.Right)
  // Try `X.length <op> 0`.
  if recv := unicornUselessLengthCheckMatchLengthAccess(ctx, lhs); recv != "" &&
    unicornUselessLengthCheckIsZero(rhs) {
    return recv
  }
  // `0 !== X.length` (no `<` form because `>` is asymmetric — covered
  // by the LHS branch above).
  if op == shimast.KindExclamationEqualsEqualsToken || op == shimast.KindExclamationEqualsToken {
    if recv := unicornUselessLengthCheckMatchLengthAccess(ctx, rhs); recv != "" &&
      unicornUselessLengthCheckIsZero(lhs) {
      return recv
    }
  }
  return ""
}

// unicornUselessLengthCheckMatchLengthAccess returns the receiver text
// when `node` is a `PropertyAccessExpression(X, length)`; "" otherwise.
func unicornUselessLengthCheckMatchLengthAccess(ctx *Context, node *shimast.Node) string {
  if node == nil || node.Kind != shimast.KindPropertyAccessExpression {
    return ""
  }
  access := node.AsPropertyAccessExpression()
  if access == nil || identifierText(access.Name()) != "length" {
    return ""
  }
  return nodeText(ctx.File, access.Expression)
}

// unicornUselessLengthCheckIsZero reports whether `node` is the numeric
// literal `0`.
func unicornUselessLengthCheckIsZero(node *shimast.Node) bool {
  return node != nil &&
    node.Kind == shimast.KindNumericLiteral &&
    numericLiteralText(node) == "0"
}

// unicornUselessLengthCheckRHSReceiver returns (method, receiverText)
// when `node` is `X.method(...)` for one of the empty-safe iteration
// methods; ("", "") otherwise.
func unicornUselessLengthCheckRHSReceiver(ctx *Context, node *shimast.Node) (string, string) {
  if node == nil || node.Kind != shimast.KindCallExpression {
    return "", ""
  }
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil ||
    call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return "", ""
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil {
    return "", ""
  }
  method := identifierText(access.Name())
  if _, ok := unicornNoUselessLengthCheckMethods[method]; !ok {
    return "", ""
  }
  return method, nodeText(ctx.File, access.Expression)
}

func init() {
  Register(unicornNoUselessLengthCheck{})
}
