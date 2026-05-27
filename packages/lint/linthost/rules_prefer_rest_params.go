// preferRestParams: a non-arrow function body that reads from
// `arguments` is using the legacy variadic-argument shape that predates
// ES6 rest parameters. Replacing the `arguments` access with
// `(...args)` declares the variadic contract on the signature, makes
// the parameter list iterable like every other JS array, and lets a
// reader see the variadic intent without reading the body.
// https://eslint.org/docs/latest/rules/prefer-rest-params
//
// AST-only: each visited function-like that owns its own `arguments`
// binding (function declaration, function expression, method, accessor,
// constructor — i.e. NOT an arrow function) is scanned for an
// `Identifier(arguments)` use inside its body. The walk stops at nested
// function-like boundaries via the shared `walkFunctionBody` helper.
// Property names like `obj.arguments` are skipped because they
// reference an unrelated member; only bare identifier reads count.
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type preferRestParams struct{}

func (preferRestParams) Name() string { return "prefer-rest-params" }
func (preferRestParams) Visits() []shimast.Kind {
	return []shimast.Kind{
		shimast.KindFunctionDeclaration,
		shimast.KindFunctionExpression,
		shimast.KindMethodDeclaration,
		shimast.KindGetAccessor,
		shimast.KindSetAccessor,
		shimast.KindConstructor,
	}
}
func (preferRestParams) Check(ctx *Context, node *shimast.Node) {
	body := preferRestParamsBody(node)
	if body == nil {
		return
	}
	reported := false
	walkFunctionBody(body, func(child *shimast.Node) {
		if reported || child == nil {
			return
		}
		if child.Kind != shimast.KindIdentifier {
			return
		}
		if identifierText(child) != "arguments" {
			return
		}
		// Skip `obj.arguments` — that's an unrelated member access.
		if parent := child.Parent; parent != nil && parent.Kind == shimast.KindPropertyAccessExpression {
			if access := parent.AsPropertyAccessExpression(); access != nil && access.Name() == child {
				return
			}
		}
		reported = true
		ctx.Report(child, "Use rest parameters (`...args`) instead of `arguments`.")
	})
}

func preferRestParamsBody(node *shimast.Node) *shimast.Node {
	switch node.Kind {
	case shimast.KindFunctionDeclaration:
		if fn := node.AsFunctionDeclaration(); fn != nil {
			return fn.Body
		}
	case shimast.KindFunctionExpression:
		if fn := node.AsFunctionExpression(); fn != nil {
			return fn.Body
		}
	case shimast.KindMethodDeclaration:
		if m := node.AsMethodDeclaration(); m != nil {
			return m.Body
		}
	case shimast.KindGetAccessor:
		if a := node.AsGetAccessorDeclaration(); a != nil {
			return a.Body
		}
	case shimast.KindSetAccessor:
		if a := node.AsSetAccessorDeclaration(); a != nil {
			return a.Body
		}
	case shimast.KindConstructor:
		if c := node.AsConstructorDeclaration(); c != nil {
			return c.Body
		}
	}
	return nil
}

func init() {
	Register(preferRestParams{})
}
