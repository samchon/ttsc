// noMixedOperators flags expressions that mix operators from different
// precedence families without explicit parentheses around the inner
// expression. The classic gotcha is `a && b || c` — readers expect
// left-to-right grouping, but `&&` binds tighter than `||`, so the
// parse tree is actually `(a && b) || c`. Wrapping the inner
// sub-expression in parens removes the ambiguity for both the parser
// and the reader.
//
// The conservative baseline only fires on the highest-confusion mixes:
//
//   - Logical mixed with a different logical (`&&` next to `||` or
//     `??`).
//   - Bitwise (`&`, `|`, `^`) next to a comparison or logical.
//
// Same-operator chains (`a && b && c`) are fine. Wrapping the inner
// child in parentheses (`(a && b) || c`) suppresses the report — the
// author has acknowledged the grouping.
// https://eslint.org/docs/latest/rules/no-mixed-operators
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type noMixedOperators struct{}

func (noMixedOperators) Name() string { return "no-mixed-operators" }
func (noMixedOperators) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindBinaryExpression}
}
func (noMixedOperators) Check(ctx *Context, node *shimast.Node) {
	expr := node.AsBinaryExpression()
	if expr == nil || expr.OperatorToken == nil {
		return
	}
	parent := noMixedOperatorsGroup(expr.OperatorToken.Kind)
	if parent == 0 {
		return
	}
	if noMixedOperatorsConflicts(parent, expr.Left, expr.OperatorToken.Kind) ||
		noMixedOperatorsConflicts(parent, expr.Right, expr.OperatorToken.Kind) {
		ctx.Report(node, "Unexpected mix of different operators. Wrap the inner expression in parentheses to make the grouping explicit.")
	}
}

// noMixedOperatorsConflicts reports whether `child` is an unparenthesized
// BinaryExpression whose operator belongs to a group that conflicts with
// the parent group. Same operator (e.g. `a && b && c`) never conflicts.
//
// Confusing pairs:
//
//   - logical mixed with a different logical (`a && b || c`),
//   - logical mixed with bitwise (`a | b && c` parses left-tight),
//   - bitwise mixed with comparison (`a & b == c` reads as both).
func noMixedOperatorsConflicts(parent int, child *shimast.Node, parentOp shimast.Kind) bool {
	if child == nil || child.Kind != shimast.KindBinaryExpression {
		return false
	}
	inner := child.AsBinaryExpression()
	if inner == nil || inner.OperatorToken == nil || inner.OperatorToken.Kind == parentOp {
		return false
	}
	childGroup := noMixedOperatorsGroup(inner.OperatorToken.Kind)
	if childGroup == 0 {
		return false
	}
	switch parent {
	case mixedGroupLogical:
		return childGroup == mixedGroupLogical || childGroup == mixedGroupBitwise
	case mixedGroupBitwise:
		return childGroup == mixedGroupLogical || childGroup == mixedGroupComparison
	}
	return false
}

const (
	mixedGroupLogical    = 1
	mixedGroupBitwise    = 2
	mixedGroupComparison = 3
)

// noMixedOperatorsGroup classifies a binary operator into the confusing-
// mix families the rule cares about. Operators outside these families
// (`+`, `-`, `*`, `/`, `**`, shifts, assignment) return 0 and are
// ignored entirely.
func noMixedOperatorsGroup(op shimast.Kind) int {
	switch op {
	case shimast.KindAmpersandAmpersandToken,
		shimast.KindBarBarToken,
		shimast.KindQuestionQuestionToken:
		return mixedGroupLogical
	case shimast.KindAmpersandToken,
		shimast.KindBarToken,
		shimast.KindCaretToken:
		return mixedGroupBitwise
	case shimast.KindEqualsEqualsToken,
		shimast.KindEqualsEqualsEqualsToken,
		shimast.KindExclamationEqualsToken,
		shimast.KindExclamationEqualsEqualsToken,
		shimast.KindLessThanToken,
		shimast.KindLessThanEqualsToken,
		shimast.KindGreaterThanToken,
		shimast.KindGreaterThanEqualsToken:
		return mixedGroupComparison
	}
	return 0
}

func init() {
	Register(noMixedOperators{})
}
