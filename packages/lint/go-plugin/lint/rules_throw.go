package lint

import shimast "github.com/microsoft/typescript-go/shim/ast"

// no-throw-literal: throw should always pass an Error subclass.
// https://eslint.org/docs/latest/rules/no-throw-literal
type noThrowLiteral struct{}

func (noThrowLiteral) Name() string             { return "no-throw-literal" }
func (noThrowLiteral) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindThrowStatement} }
func (noThrowLiteral) Check(ctx *Context, node *shimast.Node) {
	throw := node.AsThrowStatement()
	if throw == nil {
		return
	}
	expr := stripParens(throw.Expression)
	if expr == nil {
		return
	}
	if isLiteralExpression(expr) || expr.Kind == shimast.KindUndefinedKeyword {
		ctx.Report(throw.Expression, "Expected an error object to be thrown.")
		return
	}
	if id := identifierText(expr); id == "undefined" {
		ctx.Report(throw.Expression, "Expected an error object to be thrown.")
	}
}

func init() {
	Register(noThrowLiteral{})
}
