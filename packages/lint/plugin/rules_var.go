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

// prefer-const: flag `let` declarations whose binding is never reassigned.
// This follows ESLint's core rule for the common AST-local cases. It is
// intentionally conservative: destructuring and declaration-only `let`
// variables are skipped until the lint host grows full scope/data-flow state.
// ESLint canonical: https://eslint.org/docs/latest/rules/prefer-const
type preferConst struct{}

func (preferConst) Name() string           { return "prefer-const" }
func (preferConst) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (preferConst) Check(ctx *Context, node *shimast.Node) {
	type candidate struct {
		name string
		node *shimast.Node
	}
	var candidates []candidate
	assigned := map[string]bool{}

	walkDescendants(node, func(child *shimast.Node) {
		switch child.Kind {
		case shimast.KindVariableDeclaration:
			decl := child.AsVariableDeclaration()
			if decl == nil || child.Parent == nil || child.Parent.Kind != shimast.KindVariableDeclarationList {
				return
			}
			listNode := child.Parent
			if !shimast.IsLet(listNode) {
				return
			}
			name := identifierText(decl.Name())
			if name == "" {
				return
			}
			if !isConstEligibleLetDeclaration(child, decl) {
				return
			}
			candidates = append(candidates, candidate{name: name, node: child})
		case shimast.KindBinaryExpression:
			expr := child.AsBinaryExpression()
			if expr == nil || expr.OperatorToken == nil || !isAssignmentOperator(expr.OperatorToken.Kind) {
				return
			}
			for _, name := range bindingIdentifierNames(expr.Left) {
				assigned[name] = true
			}
		case shimast.KindPrefixUnaryExpression:
			expr := child.AsPrefixUnaryExpression()
			if expr == nil {
				return
			}
			if expr.Operator == shimast.KindPlusPlusToken || expr.Operator == shimast.KindMinusMinusToken {
				if name := identifierText(expr.Operand); name != "" {
					assigned[name] = true
				}
			}
		case shimast.KindPostfixUnaryExpression:
			expr := child.AsPostfixUnaryExpression()
			if expr == nil {
				return
			}
			if expr.Operator == shimast.KindPlusPlusToken || expr.Operator == shimast.KindMinusMinusToken {
				if name := identifierText(expr.Operand); name != "" {
					assigned[name] = true
				}
			}
		}
	})

	for _, c := range candidates {
		if !assigned[c.name] {
			ctx.Report(c.node, "Use const instead of let.")
		}
	}
}

func isConstEligibleLetDeclaration(node *shimast.Node, decl *shimast.VariableDeclaration) bool {
	if decl.Initializer != nil {
		if node.Parent != nil && node.Parent.Parent != nil && node.Parent.Parent.Kind == shimast.KindForStatement {
			list := node.Parent.AsVariableDeclarationList()
			return list == nil || list.Declarations == nil || len(list.Declarations.Nodes) == 1
		}
		return true
	}
	return node.Parent != nil && node.Parent.Parent != nil &&
		(node.Parent.Parent.Kind == shimast.KindForInStatement || node.Parent.Parent.Kind == shimast.KindForOfStatement)
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
	Register(preferConst{})
	Register(noUndefInit{})
}
