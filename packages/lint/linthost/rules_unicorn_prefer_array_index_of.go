// unicorn/prefer-array-index-of: `arr.findIndex(x => x === literal)` is
// the long-hand spelling of `arr.indexOf(literal)`. Both return the
// index of the first matching element; `indexOf` is a direct comparison
// against a value and is faster, shorter, and clearer about intent.
//
// AST-only: visit each `CallExpression` whose callee is
// `PropertyAccess(_, findIndex)`. The single argument must be a
// function (`ArrowFunction` or `FunctionExpression`) with exactly one
// parameter. The function body — concise body, or a block body whose
// single statement is a `return` — must be a strict-equality comparison
// between the parameter identifier and a literal (string, number,
// boolean, null, bigint). Reports on the call.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-array-index-of.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferArrayIndexOf struct{}

func (unicornPreferArrayIndexOf) Name() string { return "unicorn/prefer-array-index-of" }
func (unicornPreferArrayIndexOf) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornPreferArrayIndexOf) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil || call.Expression == nil ||
		call.Expression.Kind != shimast.KindPropertyAccessExpression {
		return
	}
	access := call.Expression.AsPropertyAccessExpression()
	if access == nil || identifierText(access.Name()) != "findIndex" {
		return
	}
	if call.Arguments == nil || len(call.Arguments.Nodes) != 1 {
		return
	}
	fn := stripParens(call.Arguments.Nodes[0])
	if fn == nil {
		return
	}
	var body *shimast.Node
	switch fn.Kind {
	case shimast.KindArrowFunction:
		arrow := fn.AsArrowFunction()
		if arrow == nil {
			return
		}
		body = arrow.Body
	case shimast.KindFunctionExpression:
		expr := fn.AsFunctionExpression()
		if expr == nil {
			return
		}
		body = expr.Body
	default:
		return
	}
	params := fn.Parameters()
	if len(params) != 1 {
		return
	}
	paramName := parameterIdentifierName(params[0])
	if paramName == "" {
		return
	}
	expr := unicornPreferArrayIndexOfBodyExpression(body)
	if expr == nil {
		return
	}
	bin := expr.AsBinaryExpression()
	if bin == nil || bin.OperatorToken == nil ||
		bin.OperatorToken.Kind != shimast.KindEqualsEqualsEqualsToken {
		return
	}
	left := stripParens(bin.Left)
	right := stripParens(bin.Right)
	if left == nil || right == nil {
		return
	}
	if unicornPreferArrayIndexOfMatchesParam(left, paramName) &&
		unicornPreferArrayIndexOfIsLiteral(right) {
		ctx.Report(node, "Prefer `Array#indexOf()` over `Array#findIndex(x => x === literal)`.")
		return
	}
	if unicornPreferArrayIndexOfMatchesParam(right, paramName) &&
		unicornPreferArrayIndexOfIsLiteral(left) {
		ctx.Report(node, "Prefer `Array#indexOf()` over `Array#findIndex(x => x === literal)`.")
	}
}

// unicornPreferArrayIndexOfBodyExpression normalizes the function body to
// the comparison expression: a concise arrow body returns its expression,
// a block body with a single `return expr;` returns the expression.
func unicornPreferArrayIndexOfBodyExpression(body *shimast.Node) *shimast.Node {
	if body == nil {
		return nil
	}
	if body.Kind != shimast.KindBlock {
		expr := stripParens(body)
		if expr == nil || expr.Kind != shimast.KindBinaryExpression {
			return nil
		}
		return expr
	}
	block := body.AsBlock()
	if block == nil || block.Statements == nil || len(block.Statements.Nodes) != 1 {
		return nil
	}
	stmt := block.Statements.Nodes[0]
	if stmt == nil || stmt.Kind != shimast.KindReturnStatement {
		return nil
	}
	ret := stmt.AsReturnStatement()
	if ret == nil || ret.Expression == nil {
		return nil
	}
	expr := stripParens(ret.Expression)
	if expr == nil || expr.Kind != shimast.KindBinaryExpression {
		return nil
	}
	return expr
}

func unicornPreferArrayIndexOfMatchesParam(node *shimast.Node, name string) bool {
	return identifierText(node) == name
}

func unicornPreferArrayIndexOfIsLiteral(node *shimast.Node) bool {
	if node == nil {
		return false
	}
	switch node.Kind {
	case shimast.KindStringLiteral,
		shimast.KindNumericLiteral,
		shimast.KindBigIntLiteral,
		shimast.KindNoSubstitutionTemplateLiteral,
		shimast.KindNullKeyword,
		shimast.KindTrueKeyword,
		shimast.KindFalseKeyword:
		return true
	}
	return false
}

func init() {
	Register(unicornPreferArrayIndexOf{})
}
