// unicorn/no-object-as-default-parameter: writing
// `function f(opts = { tag: "x" })` ships a hidden default object that
// is hard to override granularly — callers either supply the whole
// object or get every default at once, and the option keys are
// invisible at the call site. Destructuring with per-key defaults
// (`function f({ tag = "x" } = {})`) is the canonical replacement.
//
// AST-only: dispatch on `ParameterDeclaration`. Fire when the parameter
// has a non-empty object-literal initializer and the parameter name
// itself is a bare identifier (already-destructured parameters are
// covered by the destructuring form the rule recommends). Empty
// objects `param = {}` are out of scope — that pattern is a different
// rule.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-object-as-default-parameter.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoObjectAsDefaultParameter struct{}

func (unicornNoObjectAsDefaultParameter) Name() string {
	return "unicorn/no-object-as-default-parameter"
}
func (unicornNoObjectAsDefaultParameter) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindParameter}
}
func (unicornNoObjectAsDefaultParameter) Check(ctx *Context, node *shimast.Node) {
	param := node.AsParameterDeclaration()
	if param == nil || param.Initializer == nil || param.Name() == nil {
		return
	}
	if param.Name().Kind != shimast.KindIdentifier {
		return
	}
	init := stripParens(param.Initializer)
	if init == nil || init.Kind != shimast.KindObjectLiteralExpression {
		return
	}
	obj := init.AsObjectLiteralExpression()
	if obj == nil || obj.Properties == nil || len(obj.Properties.Nodes) == 0 {
		return
	}
	ctx.Report(node, "Don't use an object literal as a default parameter — destructure the option instead.")
}

func init() {
	Register(unicornNoObjectAsDefaultParameter{})
}
