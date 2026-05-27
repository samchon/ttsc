// explicitFunctionReturnType requires every named function declaration
// or class/object method to carry an explicit return-type annotation.
// An explicit return type pins the public contract: a body change cannot
// silently shift the inferred type, and readers see the result without
// running the inference algorithm in their head.
//
// AST-only baseline. The rule fires on FunctionDeclaration and
// MethodDeclaration whose `Type` field is nil. Arrow functions and
// function expressions are intentionally skipped — they appear in too
// many contextually-typed positions (callbacks, IIFEs, variables with a
// type annotation) where the typescript-eslint upstream rule itself
// exempts them, and pattern-matching every exemption from the AST alone
// is too noisy. The conservative narrowing keeps the rule actionable
// for the two declaration forms whose return type is unambiguously
// part of the API.
// https://typescript-eslint.io/rules/explicit-function-return-type/
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type explicitFunctionReturnType struct{}

func (explicitFunctionReturnType) Name() string {
	return "typescript/explicit-function-return-type"
}
func (explicitFunctionReturnType) Visits() []shimast.Kind {
	return []shimast.Kind{
		shimast.KindFunctionDeclaration,
		shimast.KindMethodDeclaration,
	}
}
func (explicitFunctionReturnType) Check(ctx *Context, node *shimast.Node) {
	var typeNode *shimast.Node
	switch node.Kind {
	case shimast.KindFunctionDeclaration:
		decl := node.AsFunctionDeclaration()
		if decl == nil {
			return
		}
		// Overload signatures (no body) already separate the return type
		// onto each declaration; skip the implementation signature when
		// it has no body either.
		if decl.Body == nil {
			return
		}
		typeNode = decl.Type
	case shimast.KindMethodDeclaration:
		decl := node.AsMethodDeclaration()
		if decl == nil {
			return
		}
		if decl.Body == nil {
			return
		}
		typeNode = decl.Type
	}
	if typeNode != nil {
		return
	}
	ctx.Report(node, "Missing return type on function — add an explicit return-type annotation.")
}

func init() {
	Register(explicitFunctionReturnType{})
}
