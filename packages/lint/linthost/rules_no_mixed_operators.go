// noMixedOperators flags expressions that mix operators from different
// precedence families without explicit parentheses around the inner
// expression. The classic gotcha is `a && b || c` — readers expect
// left-to-right grouping, but `&&` binds tighter than `||`, so the
// parse tree is actually `(a && b) || c`. Wrapping the inner
// sub-expression in parens removes the ambiguity for both the parser
// and the reader.
//
// The conservative baseline fires only on the highest-confusion mixes:
// logical mixed with a different logical, logical mixed with bitwise,
// and bitwise mixed with comparison. Same-operator chains (`a && b &&
// c`) and parenthesized inner children (`(a && b) || c`) never fire.
// https://eslint.org/docs/latest/rules/no-mixed-operators
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type noMixedOperators struct{}

const (
	mixedGroupLogical    = 1
	mixedGroupBitwise    = 2
	mixedGroupComparison = 3
)

func (noMixedOperators) Name() string         { return "no-mixed-operators" }
func (noMixedOperators) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindBinaryExpression} }
func (noMixedOperators) Check(ctx *Context, node *shimast.Node) {
	expr := node.AsBinaryExpression()
	if expr == nil || expr.OperatorToken == nil {
		return
	}
	parent := noMixedOperatorsGroup(expr.OperatorToken.Kind)
	if parent == 0 {
		return
	}
	op := expr.OperatorToken.Kind
	if noMixedOperatorsConflicts(parent, op, expr.Left) ||
		noMixedOperatorsConflicts(parent, op, expr.Right) {
		ctx.Report(node, "Unexpected mix of different operators. Wrap the inner expression in parentheses to make the grouping explicit.")
	}
}

// noMixedOperatorsConflicts returns true when `child` is an
// unparenthesized BinaryExpression whose operator group is confusing
// next to the parent group. Same operator never conflicts.
func noMixedOperatorsConflicts(parent int, parentOp shimast.Kind, child *shimast.Node) bool {
	if child == nil || child.Kind != shimast.KindBinaryExpression {
		return false
	}
	inner := child.AsBinaryExpression()
	if inner == nil || inner.OperatorToken == nil || inner.OperatorToken.Kind == parentOp {
		return false
	}
	g := noMixedOperatorsGroup(inner.OperatorToken.Kind)
	if g == 0 {
		return false
	}
	if parent == mixedGroupLogical {
		return g == mixedGroupLogical || g == mixedGroupBitwise
	}
	return parent == mixedGroupBitwise && (g == mixedGroupLogical || g == mixedGroupComparison)
}

func noMixedOperatorsGroup(op shimast.Kind) int {
	switch op {
	case shimast.KindAmpersandAmpersandToken, shimast.KindBarBarToken, shimast.KindQuestionQuestionToken:
		return mixedGroupLogical
	case shimast.KindAmpersandToken, shimast.KindBarToken, shimast.KindCaretToken:
		return mixedGroupBitwise
	case shimast.KindEqualsEqualsToken, shimast.KindEqualsEqualsEqualsToken,
		shimast.KindExclamationEqualsToken, shimast.KindExclamationEqualsEqualsToken,
		shimast.KindLessThanToken, shimast.KindLessThanEqualsToken,
		shimast.KindGreaterThanToken, shimast.KindGreaterThanEqualsToken:
		return mixedGroupComparison
	}
	return 0
}

func init() { Register(noMixedOperators{}) }
