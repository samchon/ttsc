// preferReadonly reports private class fields that are initialized at
// the declaration site (so the constructor has nothing left to assign)
// and could safely carry the `readonly` modifier. Locking the field as
// readonly catches accidental reassignments and signals the field's
// intent to readers without changing runtime behavior.
//
// AST-only baseline. Without a full body walk the rule cannot prove that
// no other method writes to the field, so the conservative trigger is:
//
//   - the member is a PropertyDeclaration sitting in a class body,
//   - it carries `private` or uses the `#name` private-hash form,
//   - it does not already carry `readonly`,
//   - it has a value initializer at declaration time.
//
// A property initialized at declaration time gets its value before the
// constructor runs, and a field that is also reassigned elsewhere
// usually does not bother to initialize at the declaration site. The
// pattern is the noisy upstream subset of the rule that is safe to
// flag without scope analysis.
// https://typescript-eslint.io/rules/prefer-readonly/
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type preferReadonly struct{}

func (preferReadonly) Name() string { return "typescript/prefer-readonly" }
func (preferReadonly) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindPropertyDeclaration}
}
func (preferReadonly) Check(ctx *Context, node *shimast.Node) {
	// Skip non-class-scoped properties; PropertyDeclaration also appears
	// inside object literals in some grammars, but the readonly modifier
	// is a class-only concern.
	parent := node.Parent
	if parent == nil ||
		(parent.Kind != shimast.KindClassDeclaration && parent.Kind != shimast.KindClassExpression) {
		return
	}
	if hasModifier(node, shimast.KindReadonlyKeyword) {
		return
	}
	if !preferReadonlyIsPrivate(node) {
		return
	}
	decl := node.AsPropertyDeclaration()
	if decl == nil || decl.Initializer == nil {
		return
	}
	// Static fields are still candidates — `private static readonly` is
	// the canonical form for class-scoped constants.
	ctx.Report(node, "Private field is only initialized at declaration time — mark it `readonly`.")
}

// preferReadonlyIsPrivate reports whether the property is private either
// through the `private` modifier or through the `#name` private-hash
// identifier form. Both make the field inaccessible from outside the
// class, so `readonly` is a safe local refinement.
func preferReadonlyIsPrivate(node *shimast.Node) bool {
	if hasModifier(node, shimast.KindPrivateKeyword) {
		return true
	}
	if name := node.Name(); name != nil && name.Kind == shimast.KindPrivateIdentifier {
		return true
	}
	return false
}

func init() {
	Register(preferReadonly{})
}
