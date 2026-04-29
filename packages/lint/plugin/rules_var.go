package main

import shimast "github.com/microsoft/typescript-go/shim/ast"

// no-var: ban `var` declarations. ESLint canonical:
// https://eslint.org/docs/latest/rules/no-var
type noVar struct{}

func (noVar) Name() string           { return "no-var" }
func (noVar) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindVariableStatement} }
func (noVar) Check(ctx *Context, node *shimast.Node) {
	stmt := node.AsVariableStatement()
	if stmt == nil || stmt.DeclarationList == nil {
		return
	}
	if shimast.IsVar(stmt.DeclarationList) {
		ctx.Report(node, "Unexpected var, use let or const instead.")
	}
}

// no-undef-init: forbid `let x = undefined` and `var x = undefined`.
// ESLint canonical: https://eslint.org/docs/latest/rules/no-undef-init
type noUndefInit struct{}

func (noUndefInit) Name() string           { return "no-undef-init" }
func (noUndefInit) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindVariableDeclaration} }
func (noUndefInit) Check(ctx *Context, node *shimast.Node) {
	decl := node.AsVariableDeclaration()
	if decl == nil || decl.Initializer == nil {
		return
	}
	if identifierText(decl.Initializer) == "undefined" {
		ctx.Report(decl.Initializer, "It's not necessary to initialize \"undefined\".")
	}
}

func init() {
	Register(noVar{})
	Register(noUndefInit{})
}
