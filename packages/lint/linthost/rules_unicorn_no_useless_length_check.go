// unicorn/no-useless-length-check: `arr.length > 0 && arr.some(…)`
// short-circuits on an empty array, but `arr.some(…)` already returns
// `false` for the empty case, so the leading length check is redundant.
// The same goes for `forEach` (returns `undefined` either way). The
// rule prunes the dead check so the call shape is the only thing the
// reader has to track.
//
// `every`, `map`, and `filter` are deliberately excluded from the `&&`
// set: `every` returns `true` on an empty array (so the length check
// IS load-bearing); `map` and `filter` return `[]` which is truthy
// (the length check changes the truthiness of the whole expression).
// Upstream covers those under the complementary `||` pattern
// (`array.length === 0 || array.every(…)`), which this MVP does not
// implement yet.
//
// AST-only MVP: visit each `BinaryExpression`, match operator `&&`,
// require LHS to be `PropertyAccess(X, length) > 0` or `!== 0`, and
// require RHS to be `CallExpression(PropertyAccess(X, name), …)` where
// `name` is one of `some` / `forEach` and the textual form of the two
// `X` expressions matches. Fire on the binary expression.
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
	ctx.Report(node, fmt.Sprintf("Useless `.length` check — `%s` already handles empty arrays correctly.", method))
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
