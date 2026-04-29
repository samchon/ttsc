package main

import shimast "github.com/microsoft/typescript-go/shim/ast"

// no-self-assign: detect `x = x` / `obj.foo = obj.foo`. Limited to the
// cheap textual identity match — sufficient for the canonical cases and
// matches the `no-self-assign` ESLint behavior on simple identifiers.
// https://eslint.org/docs/latest/rules/no-self-assign
type noSelfAssign struct{}

func (noSelfAssign) Name() string           { return "no-self-assign" }
func (noSelfAssign) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindBinaryExpression} }
func (noSelfAssign) Check(ctx *Context, node *shimast.Node) {
	expr := node.AsBinaryExpression()
	if expr == nil || expr.OperatorToken == nil {
		return
	}
	if expr.OperatorToken.Kind != shimast.KindEqualsToken {
		return
	}
	left := stripParens(expr.Left)
	right := stripParens(expr.Right)
	if left == nil || right == nil {
		return
	}
	if !isAssignableLeftHand(left) {
		return
	}
	if nodeText(ctx.File, left) == nodeText(ctx.File, right) {
		ctx.Report(node, "Self-assignment of a variable.")
	}
}

func isAssignableLeftHand(node *shimast.Node) bool {
	if node == nil {
		return false
	}
	switch node.Kind {
	case shimast.KindIdentifier, shimast.KindPropertyAccessExpression, shimast.KindElementAccessExpression:
		return true
	}
	return false
}

// no-self-compare: `x === x`, `x !== x`, etc. Useful for catching typos
// where the developer meant to compare against a different value.
// https://eslint.org/docs/latest/rules/no-self-compare
type noSelfCompare struct{}

func (noSelfCompare) Name() string           { return "no-self-compare" }
func (noSelfCompare) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindBinaryExpression} }
func (noSelfCompare) Check(ctx *Context, node *shimast.Node) {
	expr := node.AsBinaryExpression()
	if expr == nil || expr.OperatorToken == nil {
		return
	}
	if !isComparisonOperator(expr.OperatorToken.Kind) {
		return
	}
	left := stripParens(expr.Left)
	right := stripParens(expr.Right)
	if left == nil || right == nil {
		return
	}
	if nodeText(ctx.File, left) == nodeText(ctx.File, right) {
		ctx.Report(node, "Comparing to itself is potentially pointless.")
	}
}

func isComparisonOperator(kind shimast.Kind) bool {
	switch kind {
	case
		shimast.KindEqualsEqualsToken,
		shimast.KindEqualsEqualsEqualsToken,
		shimast.KindExclamationEqualsToken,
		shimast.KindExclamationEqualsEqualsToken,
		shimast.KindLessThanToken,
		shimast.KindGreaterThanToken,
		shimast.KindLessThanEqualsToken,
		shimast.KindGreaterThanEqualsToken:
		return true
	}
	return false
}

func init() {
	Register(noSelfAssign{})
	Register(noSelfCompare{})
}
