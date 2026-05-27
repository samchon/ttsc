// initDeclarations: `var x;` and `let x;` declarations without an
// initializer leave the binding holding `undefined` until the first
// assignment, which is almost always either a forgotten initialization
// or a deliberate-but-confusing two-step setup. Requiring the
// initializer at the declaration site makes the binding's first value
// obvious at a glance and removes one mid-block surprise.
// https://eslint.org/docs/latest/rules/init-declarations
//
// AST-only. Visits `VariableStatement` and reports every
// `VariableDeclaration` inside that lacks an `Initializer`. `const`
// declarations are skipped — the grammar already requires `const x =
// ...`, so a `const` without an initializer is a syntax error, not a
// rule violation. The corpus runner enables the rule via its `expect:`
// annotation; the rule has no options.
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type initDeclarations struct{}

func (initDeclarations) Name() string { return "init-declarations" }
func (initDeclarations) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindVariableStatement}
}
func (initDeclarations) Check(ctx *Context, node *shimast.Node) {
	stmt := node.AsVariableStatement()
	if stmt == nil || stmt.DeclarationList == nil {
		return
	}
	list := stmt.DeclarationList.AsVariableDeclarationList()
	if list == nil || list.Declarations == nil {
		return
	}
	// `const` declarations are syntactically required to carry an
	// initializer, so skip the whole list when the modifier is `const`.
	if list.Flags&shimast.NodeFlagsConst != 0 {
		return
	}
	for _, decl := range list.Declarations.Nodes {
		if decl == nil {
			continue
		}
		v := decl.AsVariableDeclaration()
		if v == nil || v.Initializer != nil {
			continue
		}
		ctx.Report(decl, "Expected variable declaration to be initialized.")
	}
}

func init() {
	Register(initDeclarations{})
}
