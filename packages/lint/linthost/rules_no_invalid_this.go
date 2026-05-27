// noInvalidThis: reject `this` references that have no meaningful
// binding — that is, `this` used outside any function-like context or
// class static block. At the top level of a module (and in strict-mode
// scripts) `this` is `undefined`, so reading from it usually signals a
// copy-paste from a class method.
//
// Arrow functions inherit `this` from their enclosing lexical scope, so
// the rule walks past arrow boundaries when searching for a binding
// site. Plain function declarations, function expressions, methods,
// accessors, constructors, and class static blocks each create their
// own `this` and stop the walk.
// https://eslint.org/docs/latest/rules/no-invalid-this
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type noInvalidThis struct{}

func (noInvalidThis) Name() string           { return "no-invalid-this" }
func (noInvalidThis) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindThisKeyword} }
func (noInvalidThis) Check(ctx *Context, node *shimast.Node) {
	if hasThisBindingAncestor(node) {
		return
	}
	ctx.Report(node, "Unexpected 'this'.")
}

// hasThisBindingAncestor reports whether `node` is lexically enclosed by
// a construct that defines its own `this`. Arrow functions are skipped
// because they capture `this` from the surrounding scope; the walk only
// stops on a real binding site or at the SourceFile root.
func hasThisBindingAncestor(node *shimast.Node) bool {
	for cur := node.Parent; cur != nil; cur = cur.Parent {
		switch cur.Kind {
		case shimast.KindFunctionDeclaration,
			shimast.KindFunctionExpression,
			shimast.KindMethodDeclaration,
			shimast.KindGetAccessor,
			shimast.KindSetAccessor,
			shimast.KindConstructor,
			shimast.KindClassStaticBlockDeclaration:
			return true
		}
	}
	return false
}

func init() {
	Register(noInvalidThis{})
}
