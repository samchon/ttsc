// unboundMethod reports a property access that names a class instance
// method but is used as a value instead of being immediately invoked.
// JavaScript methods are not bound to their receiver — `obj.method`,
// once extracted, loses the `this` binding the body relies on, so
// passing it as a callback (`setTimeout(obj.method, 0)`) or aliasing
// it (`const f = obj.method`) silently breaks at the first `this.x`
// dereference. typescript-eslint:
// https://typescript-eslint.io/rules/unbound-method/
//
// Type-aware. The Checker resolves the property's symbol; the rule
// fires when any of the symbol's declarations is a class
// MethodDeclaration. The conservative baseline skips:
//
//   - the callee position of a call (`obj.method()` is fine);
//   - the left-hand side of an assignment (`obj.method = fn`);
//   - the operand of `typeof`, `delete`, `instanceof`, and `in`;
//   - tagged-template tag positions;
//   - static methods (the constructor that owns them is stably bound);
//   - methods declared only as MethodSignature on an interface or
//     type literal (those are structural — the runtime value may be a
//     plain function property, and flagging them at every consumer
//     produces too many false positives).
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type unboundMethod struct{}

func (unboundMethod) Name() string { return "typescript/unbound-method" }
func (unboundMethod) NeedsTypeChecker() bool {
	return true
}
func (unboundMethod) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindPropertyAccessExpression}
}
func (unboundMethod) Check(ctx *Context, node *shimast.Node) {
	if ctx.Checker == nil {
		return
	}
	access := node.AsPropertyAccessExpression()
	if access == nil || access.Name() == nil {
		return
	}
	if unboundMethodSafePosition(node) {
		return
	}
	symbol := ctx.Checker.GetSymbolAtLocation(access.Name())
	if symbol == nil {
		return
	}
	if !unboundMethodSymbolIsClassMethod(symbol) {
		return
	}
	ctx.Report(node, "Avoid referencing an unbound method which may cause unintentional scoping of `this`.")
}

// unboundMethodSafePosition reports whether the property access sits in
// a syntactic position that already discharges the unbound-method risk.
// The list mirrors typescript-eslint's safe-position whitelist: an
// immediately-invoked call, an assignment target, a typeof / delete
// operand, an instanceof / in operand, and a tagged-template tag are
// all positions where the method reference is consumed in place rather
// than carried away as a free function value.
func unboundMethodSafePosition(node *shimast.Node) bool {
	parent := node.Parent
	if parent == nil {
		return false
	}
	switch parent.Kind {
	case shimast.KindCallExpression:
		call := parent.AsCallExpression()
		if call != nil && call.Expression == node {
			return true
		}
	case shimast.KindTaggedTemplateExpression:
		return true
	case shimast.KindBinaryExpression:
		bin := parent.AsBinaryExpression()
		if bin == nil || bin.OperatorToken == nil {
			return false
		}
		switch bin.OperatorToken.Kind {
		case shimast.KindEqualsToken,
			shimast.KindInstanceOfKeyword,
			shimast.KindInKeyword:
			return true
		}
	case shimast.KindTypeOfExpression, shimast.KindDeleteExpression:
		return true
	}
	return false
}

// unboundMethodSymbolIsClassMethod reports whether symbol denotes a
// non-static class instance method. The rule ignores plain method
// signatures on interfaces and type literals because those are
// structural — the runtime value may be a regular function rather
// than a bound class member, and flagging them at every consumer
// would produce a high false-positive volume. Static methods slip
// past this check because they are accessed through the class
// constructor itself, which is bound for the lifetime of the
// program.
func unboundMethodSymbolIsClassMethod(symbol *shimast.Symbol) bool {
	if symbol == nil {
		return false
	}
	for _, decl := range symbol.Declarations {
		if decl == nil {
			continue
		}
		if decl.Kind != shimast.KindMethodDeclaration {
			continue
		}
		if hasModifier(decl, shimast.KindStaticKeyword) {
			continue
		}
		return true
	}
	return false
}

func init() {
	Register(unboundMethod{})
}
