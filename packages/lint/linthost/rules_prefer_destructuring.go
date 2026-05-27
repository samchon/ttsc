// preferDestructuring: a variable declaration whose initializer is a
// single property or index access (`const a = obj.a;`, `const x =
// arr[0];`) is just longhand for the destructuring form (`const { a }
// = obj;`, `const [x] = arr;`). The destructuring form reads at the
// site as "extracts this from that", names the source object once, and
// scales to multi-field extraction without retyping the receiver.
// https://eslint.org/docs/latest/rules/prefer-destructuring
//
// AST-only: each visited `VariableDeclaration` is checked for an
// initializer shape that destructuring would replace verbatim:
//
//   - `obj.<name>` where the variable name matches `<name>`
//   - `arr[<n>]` where `<n>` is a numeric literal
//
// Computed string-literal access (`obj["a"]`) is skipped — that idiom
// is usually deliberate (e.g. key with hyphens or reserved-word
// keys). The receiver must be a plain identifier or property access;
// call expressions and other compound shapes are not flagged because
// the receiver would be re-evaluated under destructuring.
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type preferDestructuring struct{}

func (preferDestructuring) Name() string { return "prefer-destructuring" }
func (preferDestructuring) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindVariableDeclaration}
}
func (preferDestructuring) Check(ctx *Context, node *shimast.Node) {
	decl := node.AsVariableDeclaration()
	if decl == nil || decl.Initializer == nil {
		return
	}
	// Only fire on plain identifier bindings — destructuring already
	// happens on `const { a } = obj;`.
	name := decl.Name()
	if name == nil || name.Kind != shimast.KindIdentifier {
		return
	}
	varName := identifierText(name)
	if varName == "" {
		return
	}
	init := stripParens(decl.Initializer)
	if init == nil {
		return
	}
	switch init.Kind {
	case shimast.KindPropertyAccessExpression:
		access := init.AsPropertyAccessExpression()
		if access == nil || access.Expression == nil || !preferDestructuringSimpleReceiver(access.Expression) {
			return
		}
		propName := access.Name()
		if propName == nil || propName.Kind != shimast.KindIdentifier {
			return
		}
		if identifierText(propName) != varName {
			return
		}
		ctx.Report(node, "Use object destructuring (`const { "+varName+" } = obj`).")
	case shimast.KindElementAccessExpression:
		access := init.AsElementAccessExpression()
		if access == nil || access.Expression == nil || access.ArgumentExpression == nil {
			return
		}
		if !preferDestructuringSimpleReceiver(access.Expression) {
			return
		}
		// Only numeric-literal index — array destructuring.
		idx := stripParens(access.ArgumentExpression)
		if idx == nil || idx.Kind != shimast.KindNumericLiteral {
			return
		}
		ctx.Report(node, "Use array destructuring (`const ["+varName+"] = arr`).")
	}
}

func preferDestructuringSimpleReceiver(node *shimast.Node) bool {
	n := stripParens(node)
	if n == nil {
		return false
	}
	switch n.Kind {
	case shimast.KindIdentifier,
		shimast.KindThisKeyword,
		shimast.KindPropertyAccessExpression:
		return true
	}
	return false
}

func init() {
	Register(preferDestructuring{})
}
