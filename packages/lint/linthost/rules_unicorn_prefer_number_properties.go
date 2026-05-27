// unicorn/prefer-number-properties: the global functions `isNaN`,
// `isFinite`, `parseFloat`, `parseInt`, and the global constants `NaN`,
// `Infinity` were aliased onto the `Number` namespace in ES2015. The
// `Number.*` forms coerce more predictably (`Number.isNaN("abc")` is
// `false`, while the global `isNaN("abc")` is `true`) and are more
// discoverable. The rule pushes authors to the namespaced spellings.
//
// AST-only: visit each `Identifier`. The text must be one of the six
// shadowable names. The identifier must be in a value-expression
// position — not the name part of a property access (`obj.isNaN`),
// not the key of a property assignment, and not a binding name. Reports
// on the identifier.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-number-properties.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

var unicornPreferNumberPropertiesNames = map[string]struct{}{
	"isNaN":      {},
	"isFinite":   {},
	"parseFloat": {},
	"parseInt":   {},
	"NaN":        {},
	"Infinity":   {},
}

type unicornPreferNumberProperties struct{}

func (unicornPreferNumberProperties) Name() string {
	return "unicorn/prefer-number-properties"
}
func (unicornPreferNumberProperties) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindIdentifier}
}
func (unicornPreferNumberProperties) Check(ctx *Context, node *shimast.Node) {
	name := identifierText(node)
	if _, ok := unicornPreferNumberPropertiesNames[name]; !ok {
		return
	}
	parent := node.Parent
	if parent == nil {
		return
	}
	switch parent.Kind {
	case shimast.KindPropertyAccessExpression:
		// `obj.isNaN` — the identifier is the property name, not a
		// reference to the global. `Number.isNaN(...)` itself also
		// reaches here and must not be flagged.
		access := parent.AsPropertyAccessExpression()
		if access != nil && access.Name() == node {
			return
		}
	case shimast.KindQualifiedName:
		// Type-position `A.B` — same rationale as PropertyAccess.
		return
	case shimast.KindPropertyAssignment,
		shimast.KindShorthandPropertyAssignment,
		shimast.KindMethodDeclaration,
		shimast.KindPropertyDeclaration,
		shimast.KindEnumMember,
		shimast.KindPropertySignature,
		shimast.KindMethodSignature,
		shimast.KindGetAccessor,
		shimast.KindSetAccessor:
		// Member name slots on object/class shapes.
		return
	case shimast.KindParameter,
		shimast.KindVariableDeclaration,
		shimast.KindBindingElement,
		shimast.KindFunctionDeclaration,
		shimast.KindFunctionExpression,
		shimast.KindClassDeclaration,
		shimast.KindClassExpression,
		shimast.KindImportSpecifier,
		shimast.KindImportClause,
		shimast.KindNamespaceImport,
		shimast.KindExportSpecifier,
		shimast.KindTypeParameter,
		shimast.KindLabeledStatement:
		// Binding / declaration names, not references to the global.
		return
	}
	ctx.Report(node, "Prefer `Number.<X>` over the global `<X>` (e.g. `Number.isNaN`, `Number.parseInt`).")
}

func init() {
	Register(unicornPreferNumberProperties{})
}
