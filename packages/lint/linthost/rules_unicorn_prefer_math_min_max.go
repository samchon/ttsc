// unicorn/prefer-math-min-max: `a < b ? a : b` is the long-hand spelling
// of `Math.min(a, b)`; the conditional adds a branch and reads each
// operand twice to do what the built-in does in one call. The built-ins
// also handle the NaN edge case the conditional silently mis-routes,
// so the rule pushes authors to switch.
//
// AST-only: visit `KindConditionalExpression`. Fire when the condition
// (after `stripParens`) is a `KindBinaryExpression` whose operator is one
// of `<`, `<=`, `>`, `>=` AND its two operands read textually as the
// two branches of the conditional (either order — `a < b ? a : b` and
// `a < b ? b : a` both qualify, since the rule covers both `Math.min`
// and `Math.max`).
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-math-min-max.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferMathMinMax struct{}

func (unicornPreferMathMinMax) Name() string { return "unicorn/prefer-math-min-max" }
func (unicornPreferMathMinMax) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindConditionalExpression}
}
func (unicornPreferMathMinMax) Check(ctx *Context, node *shimast.Node) {
	cond := node.AsConditionalExpression()
	if cond == nil {
		return
	}
	condExpr := stripParens(cond.Condition)
	if condExpr == nil || condExpr.Kind != shimast.KindBinaryExpression {
		return
	}
	bin := condExpr.AsBinaryExpression()
	if bin == nil || bin.OperatorToken == nil {
		return
	}
	switch bin.OperatorToken.Kind {
	case shimast.KindLessThanToken,
		shimast.KindLessThanEqualsToken,
		shimast.KindGreaterThanToken,
		shimast.KindGreaterThanEqualsToken:
	default:
		return
	}
	leftText := nodeText(ctx.File, stripParens(bin.Left))
	rightText := nodeText(ctx.File, stripParens(bin.Right))
	if leftText == "" || rightText == "" {
		return
	}
	trueText := nodeText(ctx.File, stripParens(cond.WhenTrue))
	falseText := nodeText(ctx.File, stripParens(cond.WhenFalse))
	if (leftText == trueText && rightText == falseText) ||
		(leftText == falseText && rightText == trueText) {
		ctx.Report(node, "Prefer `Math.min` / `Math.max` over a conditional comparing the same two values.")
	}
}

func init() {
	Register(unicornPreferMathMinMax{})
}
