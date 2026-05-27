// unicorn/prefer-array-some: `arr.filter(predicate).length > 0` walks the
// whole array and allocates an intermediate filtered array just to ask
// the boolean question "does any element match?". `arr.some(predicate)`
// short-circuits at the first hit and reads as the intent.
//
// AST-only: visit each `BinaryExpression`. The operator must be one of
// `>`, `>=`, `!==`, `!=`. The left operand must be
// `PropertyAccess(CallExpression(_, filter), length)`. The right operand
// must be the numeric literal `0`. Reports on the binary expression.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-array-some.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferArraySome struct{}

func (unicornPreferArraySome) Name() string { return "unicorn/prefer-array-some" }
func (unicornPreferArraySome) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindBinaryExpression}
}
func (unicornPreferArraySome) Check(ctx *Context, node *shimast.Node) {
	bin := node.AsBinaryExpression()
	if bin == nil || bin.OperatorToken == nil || bin.Left == nil || bin.Right == nil {
		return
	}
	switch bin.OperatorToken.Kind {
	case shimast.KindGreaterThanToken,
		shimast.KindGreaterThanEqualsToken,
		shimast.KindExclamationEqualsEqualsToken,
		shimast.KindExclamationEqualsToken:
	default:
		return
	}
	right := stripParens(bin.Right)
	if right == nil || right.Kind != shimast.KindNumericLiteral {
		return
	}
	if numericLiteralText(right) != "0" {
		return
	}
	left := stripParens(bin.Left)
	if left == nil || left.Kind != shimast.KindPropertyAccessExpression {
		return
	}
	outer := left.AsPropertyAccessExpression()
	if outer == nil || identifierText(outer.Name()) != "length" {
		return
	}
	receiver := stripParens(outer.Expression)
	if receiver == nil || receiver.Kind != shimast.KindCallExpression {
		return
	}
	call := receiver.AsCallExpression()
	if call == nil || call.Expression == nil ||
		call.Expression.Kind != shimast.KindPropertyAccessExpression {
		return
	}
	access := call.Expression.AsPropertyAccessExpression()
	if access == nil || identifierText(access.Name()) != "filter" {
		return
	}
	ctx.Report(node, "Prefer `Array#some()` over `.filter(...).length > 0`.")
}

func init() {
	Register(unicornPreferArraySome{})
}
