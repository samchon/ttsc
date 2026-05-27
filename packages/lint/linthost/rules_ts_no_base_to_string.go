// typescript/no-base-to-string: a string-coercion context that
// resolves `toString` to the default `Object.prototype.toString`
// produces the useless `"[object Object]"` placeholder at runtime.
// typescript-eslint:
// https://typescript-eslint.io/rules/no-base-to-string/
//
// Type-aware. The rule visits the three shapes that implicitly coerce
// a value through `toString`:
//
//   - `${x}` — every interpolated expression in a TemplateExpression;
//   - `x + y` — when one operand is statically string-typed the other
//     operand is coerced;
//   - `String(x)` — explicit one-argument coercion.
//
// A type is "safely stringifiable" when it is a primitive-like type
// (`string`-/`number`-/`bigint`-/`boolean`-like, `null`, `undefined`),
// when the Checker reports it as `any` / `unknown` / `never` (those
// escape strict reasoning the same way `await-thenable` lets them
// pass), or when it overrides `toString` away from the global
// `Object` interface. Unions are safe only when every constituent is
// safe; intersections are safe when any constituent is safe.
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

type noBaseToString struct{}

func (noBaseToString) Name() string { return "typescript/no-base-to-string" }
func (noBaseToString) NeedsTypeChecker() bool {
	return true
}
func (noBaseToString) Visits() []shimast.Kind {
	return []shimast.Kind{
		shimast.KindTemplateExpression,
		shimast.KindBinaryExpression,
		shimast.KindCallExpression,
	}
}
func (noBaseToString) Check(ctx *Context, node *shimast.Node) {
	if ctx.Checker == nil {
		return
	}
	switch node.Kind {
	case shimast.KindTemplateExpression:
		expr := node.AsTemplateExpression()
		if expr == nil || expr.TemplateSpans == nil {
			return
		}
		for _, spanNode := range expr.TemplateSpans.Nodes {
			span := spanNode.AsTemplateSpan()
			if span == nil || span.Expression == nil {
				continue
			}
			reportIfBaseToString(ctx, span.Expression)
		}
	case shimast.KindBinaryExpression:
		bin := node.AsBinaryExpression()
		if bin == nil || bin.OperatorToken == nil || bin.OperatorToken.Kind != shimast.KindPlusToken {
			return
		}
		left := stripParens(bin.Left)
		right := stripParens(bin.Right)
		if left == nil || right == nil {
			return
		}
		leftType := ctx.Checker.GetTypeAtLocation(left)
		rightType := ctx.Checker.GetTypeAtLocation(right)
		if isStringLikeType(leftType) {
			if !isSafeToStringType(ctx.Checker, rightType) {
				ctx.Report(right, baseToStringMessage)
			}
		} else if isStringLikeType(rightType) {
			if !isSafeToStringType(ctx.Checker, leftType) {
				ctx.Report(left, baseToStringMessage)
			}
		}
	case shimast.KindCallExpression:
		call := node.AsCallExpression()
		if call == nil || call.Expression == nil || call.Arguments == nil {
			return
		}
		if call.Expression.Kind != shimast.KindIdentifier || identifierText(call.Expression) != "String" {
			return
		}
		if len(call.Arguments.Nodes) != 1 {
			return
		}
		reportIfBaseToString(ctx, call.Arguments.Nodes[0])
	}
}

const baseToStringMessage = "Value implicitly coerces to '[object Object]'. Override `toString` or pass an explicit string representation."

func reportIfBaseToString(ctx *Context, expr *shimast.Node) {
	if expr == nil {
		return
	}
	t := ctx.Checker.GetTypeAtLocation(expr)
	if isSafeToStringType(ctx.Checker, t) {
		return
	}
	ctx.Report(expr, baseToStringMessage)
}

// isStringLikeType reports whether t is provably string-typed (a
// literal, the primitive, a template-literal type, or any combination
// thereof). Used to decide whether the OTHER operand of a `+`
// expression is being coerced.
func isStringLikeType(t *shimchecker.Type) bool {
	if t == nil {
		return false
	}
	flags := t.Flags()
	if flags&shimchecker.TypeFlagsStringLike != 0 {
		return true
	}
	if flags&shimchecker.TypeFlagsUnion != 0 {
		for _, part := range t.Types() {
			if !isStringLikeType(part) {
				return false
			}
		}
		return true
	}
	return false
}

// isSafeToStringType reports whether `t` can be implicitly coerced to a
// string without producing the default `Object.prototype.toString`
// output. The shape mirrors `isAwaitable` in rules_promise.go: union
// constituents must all be safe; intersection constituents are safe
// when any one of them is. The `any` / `unknown` / `never` cases pass
// because flagging them would explode at generic-helper boundaries —
// the same conservatism `no-floating-promises` adopts.
func isSafeToStringType(checker *shimchecker.Checker, t *shimchecker.Type) bool {
	if checker == nil || t == nil {
		return true
	}
	flags := t.Flags()
	if flags&(shimchecker.TypeFlagsAny|shimchecker.TypeFlagsUnknown|shimchecker.TypeFlagsNever) != 0 {
		return true
	}
	if flags&(shimchecker.TypeFlagsStringLike|
		shimchecker.TypeFlagsNumberLike|
		shimchecker.TypeFlagsBigIntLike|
		shimchecker.TypeFlagsBooleanLike|
		shimchecker.TypeFlagsNull|
		shimchecker.TypeFlagsUndefined) != 0 {
		return true
	}
	if flags&shimchecker.TypeFlagsUnion != 0 {
		for _, part := range t.Types() {
			if !isSafeToStringType(checker, part) {
				return false
			}
		}
		return true
	}
	if flags&shimchecker.TypeFlagsIntersection != 0 {
		for _, part := range t.Types() {
			if isSafeToStringType(checker, part) {
				return true
			}
		}
		return false
	}
	return typeOverridesToString(checker, t)
}

// typeOverridesToString reports whether `t` carries a `toString` method
// that is NOT the default declaration on the global `Object` interface.
// The lib.es5.d.ts `Object` interface declares `toString(): string`; a
// custom override is what makes coercion meaningful at runtime. If no
// `toString` is reachable at all the type is treated as base — the
// only way to coerce it is the prototype-chain default.
func typeOverridesToString(checker *shimchecker.Checker, t *shimchecker.Type) bool {
	prop := checker.GetPropertyOfType(t, "toString")
	if prop == nil {
		return false
	}
	for _, decl := range prop.Declarations {
		if decl == nil {
			continue
		}
		if !isObjectToStringDeclaration(decl) {
			return true
		}
	}
	return false
}

// isObjectToStringDeclaration reports whether `decl` is the
// `toString(): string` member that lives on the global `Object`
// interface in lib.es5.d.ts. Walking the parent chain stops at the
// nearest `interface Object {}` / `interface ObjectConstructor {}`
// declaration; anything else (Array, Date, Error, user classes, etc.)
// counts as a real override.
func isObjectToStringDeclaration(decl *shimast.Node) bool {
	parent := decl.Parent
	if parent == nil {
		return false
	}
	if parent.Kind != shimast.KindInterfaceDeclaration {
		return false
	}
	iface := parent.AsInterfaceDeclaration()
	if iface == nil {
		return false
	}
	return identifierText(iface.Name()) == "Object"
}

func init() {
	Register(noBaseToString{})
}
