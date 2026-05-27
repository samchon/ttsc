// unicorn/prefer-negative-index: `arr.slice(arr.length - N)` is the
// long-hand spelling of `arr.slice(-N)`. The subtraction repeats the
// receiver, allocates an extra read, and obscures the intent. The same
// idiom shows up across `slice`, `splice`, `toSpliced`, `at`, and
// `lastIndexOf`; all five accept a negative index that means the same
// thing the subtraction expresses, so the rule pushes authors there.
//
// AST-only: visit `KindCallExpression`. Fire when the callee is
// `PropertyAccess(_, name)` for one of those five method names AND the
// first argument is a `KindBinaryExpression` with operator `-`, LHS a
// `PropertyAccess(_, length)`, and RHS a positive numeric literal.
// Reports on the offending argument so the diagnostic anchors to the
// expression the author would rewrite.
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
	case "slice", "splice", "toSpliced", "at", "lastIndexOf":
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
