// unicorn/no-static-only-class: a class whose every member is `static`
// is a namespace dressed up as a class. The `class` keyword introduces
// a constructor, a prototype chain, and `new`-able semantics that the
// static-only form never uses. A plain object literal or a module
// namespace is the more honest shape.
//
// AST-only: visit both `ClassDeclaration` and `ClassExpression`. The
// rule requires at least one member (empty classes are handled by a
// separate rule) and every member must be a method, property, getter,
// or setter declaration with the `static` modifier. Constructors,
// index signatures, and any non-static member disqualify the class.
// Classes with heritage clauses (`extends`, `implements`) are also
// skipped — the inheritance IS the reason the class exists, so it
// can't be replaced by a plain object.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-static-only-class.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoStaticOnlyClass struct{}

func (unicornNoStaticOnlyClass) Name() string { return "unicorn/no-static-only-class" }
func (unicornNoStaticOnlyClass) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindClassDeclaration, shimast.KindClassExpression}
}
func (unicornNoStaticOnlyClass) Check(ctx *Context, node *shimast.Node) {
	if classHasHeritage(node) {
		return
	}
	members := classMembers(node)
	if len(members) == 0 {
		// Empty classes are out of scope — separate rule territory.
		return
	}
	for _, member := range members {
		if member == nil {
			return
		}
		switch member.Kind {
		case shimast.KindMethodDeclaration,
			shimast.KindPropertyDeclaration,
			shimast.KindGetAccessor,
			shimast.KindSetAccessor:
			if !hasModifier(member, shimast.KindStaticKeyword) {
				return
			}
		default:
			return
		}
	}
	ctx.Report(node, "A class with only static members can be replaced by a plain object or module namespace.")
}

func init() {
	Register(unicornNoStaticOnlyClass{})
}
