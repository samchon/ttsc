// unicorn/catch-error-name: a `catch (err)` clause whose binding is
// anything other than `error` violates the project convention. The
// stylistic point is that readers should see `catch (error)` and
// immediately know the binding is the thrown value — bespoke names
// like `e`, `err`, or `exception` create one-character variance for
// no semantic gain.
//
// AST-only: visit each `CatchClause`, skip clauses with no binding
// (optional catch-binding) and clauses whose binding is a destructuring
// pattern (out of scope — the rule cannot rename a pattern in place).
// When the binding identifier text is not `error`, report on the
// identifier node so the diagnostic underlines the offending name.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/catch-error-name.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornCatchErrorName struct{}

func (unicornCatchErrorName) Name() string { return "unicorn/catch-error-name" }
func (unicornCatchErrorName) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCatchClause}
}
func (unicornCatchErrorName) Check(ctx *Context, node *shimast.Node) {
	catch := node.AsCatchClause()
	if catch == nil || catch.VariableDeclaration == nil {
		return
	}
	binding := catch.VariableDeclaration.Name()
	if binding == nil {
		return
	}
	// Destructuring (object/array binding pattern) is out of scope.
	if binding.Kind != shimast.KindIdentifier {
		return
	}
	name := identifierText(binding)
	if name == "" || name == "error" {
		return
	}
	ctx.Report(binding, "The catch parameter should be named `error`.")
}

func init() {
	Register(unicornCatchErrorName{})
}
