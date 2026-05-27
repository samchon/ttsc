// unicorn/no-negation-in-equality-check: `!a === b` parses as
// `(!a) === b`, comparing the *boolean* `!a` against `b`. Readers
// almost always expect `!(a === b)` instead, so the rule rejects the
// `!a === b` / `!a !== b` shape and asks the author to either switch
// the comparison operator (`a !== b`) or wrap the negation in parens.
//
// AST-only: visit each `BinaryExpression`, match the operator against
// the four equality tokens, and check whether the LEFT operand (after
// stripping parens) is a `!` prefix-unary expression. Fire on the
// binary expression so the report covers the full ambiguous shape.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-negation-in-equality-check.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoNegationInEqualityCheck struct{}

func (unicornNoNegationInEqualityCheck) Name() string {
	return "unicorn/no-negation-in-equality-check"
}
func (unicornNoNegationInEqualityCheck) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindBinaryExpression}
}
func (unicornNoNegationInEqualityCheck) Check(ctx *Context, node *shimast.Node) {
	bin := node.AsBinaryExpression()
	if bin == nil || bin.OperatorToken == nil || bin.Left == nil {
		return
	}
	switch bin.OperatorToken.Kind {
	case shimast.KindEqualsEqualsEqualsToken,
		shimast.KindEqualsEqualsToken,
		shimast.KindExclamationEqualsEqualsToken,
		shimast.KindExclamationEqualsToken:
	default:
		return
	}
	left := stripParens(bin.Left)
	if left == nil || left.Kind != shimast.KindPrefixUnaryExpression {
		return
	}
	prefix := left.AsPrefixUnaryExpression()
	if prefix == nil || prefix.Operator != shimast.KindExclamationToken {
		return
	}
	ctx.Report(node, "Don't negate the left operand of an equality check — use `!==` directly, or wrap in parens.")
}

func init() {
	Register(unicornNoNegationInEqualityCheck{})
}
