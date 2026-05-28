// unicorn/consistent-existence-index-check: the same index-presence
// test has two equivalent shapes — `arr.indexOf(x) === -1` (and the
// `!== -1` complement) versus `arr.indexOf(x) < 0` / `>= 0`. Either
// works at runtime, but a project should pick one. The canonical form
// pinned here is the explicit `=== -1` / `!== -1`; the magnitude
// comparison reads as math rather than as a presence check.
//
// AST-only: visit each `BinaryExpression`. Fire when the operator is
// `<` or `>=`, the LEFT operand is a `CallExpression(PropertyAccess(_,
// methodName))` whose method name is one of the index-returning Array
// prototype methods, AND the right operand is a `0` literal. Only the
// canonical orientation (`indexOf(x) < 0` / `indexOf(x) >= 0`) is
// flagged; the swapped form (`0 < indexOf(x)`) has different
// semantics ("found at index >= 1") and is intentionally not
// recognized. The `=== -1` / `!== -1` orientation is the desired form,
// so it does not fire.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/consistent-existence-index-check.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

var unicornConsistentExistenceIndexCheckMethods = map[string]struct{}{
	"indexOf":       {},
	"findIndex":     {},
	"lastIndexOf":   {},
	"findLastIndex": {},
}

type unicornConsistentExistenceIndexCheck struct{}

func (unicornConsistentExistenceIndexCheck) Name() string {
	return "unicorn/consistent-existence-index-check"
}
func (unicornConsistentExistenceIndexCheck) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindBinaryExpression}
}
func (unicornConsistentExistenceIndexCheck) Check(ctx *Context, node *shimast.Node) {
	bin := node.AsBinaryExpression()
	if bin == nil || bin.OperatorToken == nil || bin.Left == nil || bin.Right == nil {
		return
	}
	switch bin.OperatorToken.Kind {
	case shimast.KindLessThanToken, shimast.KindGreaterThanEqualsToken:
	default:
		return
	}
	left := stripParens(bin.Left)
	right := stripParens(bin.Right)
	if unicornConsistentExistenceIndexCheckMatch(left, right) {
		ctx.Report(node, "Use a consistent existence-check form for `indexOf` / `findIndex` — prefer `=== -1` / `!== -1` over magnitude comparisons.")
	}
}

func unicornConsistentExistenceIndexCheckMatch(callSide, literalSide *shimast.Node) bool {
	if callSide == nil || literalSide == nil {
		return false
	}
	if literalSide.Kind != shimast.KindNumericLiteral ||
		numericLiteralText(literalSide) != "0" {
		return false
	}
	if callSide.Kind != shimast.KindCallExpression {
		return false
	}
	call := callSide.AsCallExpression()
	if call == nil || call.Expression == nil ||
		call.Expression.Kind != shimast.KindPropertyAccessExpression {
		return false
	}
	access := call.Expression.AsPropertyAccessExpression()
	if access == nil {
		return false
	}
	_, ok := unicornConsistentExistenceIndexCheckMethods[identifierText(access.Name())]
	return ok
}

func init() {
	Register(unicornConsistentExistenceIndexCheck{})
}
