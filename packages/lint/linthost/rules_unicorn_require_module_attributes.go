// unicorn/require-module-attributes: import / export `with { … }`
// clauses carry semantic information (`type: "json"`, `type: "css"`).
// Writing `with {}` with no entries serves no purpose and is almost
// always a mistake. The rule fires when an import or export carries an
// attributes clause with zero attribute entries.
//
// AST-only: visit `KindImportDeclaration` and `KindExportDeclaration`,
// follow the `.Attributes` field (an `ImportAttributesNode`), descend
// into its inner `ImportAttributes.Attributes` list, and report when
// the list is present but empty. The clause-present-but-empty shape is
// rare in practice but legal syntax, so a precise zero-entry check is
// the right anchor.
//
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/require-module-attributes.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornRequireModuleAttributes struct{}

func (unicornRequireModuleAttributes) Name() string {
	return "unicorn/require-module-attributes"
}
func (unicornRequireModuleAttributes) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindImportDeclaration, shimast.KindExportDeclaration}
}
func (unicornRequireModuleAttributes) Check(ctx *Context, node *shimast.Node) {
	var attrs *shimast.Node
	switch node.Kind {
	case shimast.KindImportDeclaration:
		if decl := node.AsImportDeclaration(); decl != nil {
			attrs = decl.Attributes
		}
	case shimast.KindExportDeclaration:
		if decl := node.AsExportDeclaration(); decl != nil {
			attrs = decl.Attributes
		}
	}
	if attrs == nil {
		return
	}
	imp := attrs.AsImportAttributes()
	if imp == nil {
		return
	}
	if imp.Attributes != nil && len(imp.Attributes.Nodes) > 0 {
		return
	}
	ctx.Report(node, "Import/export `with {}` should have at least one attribute.")
}

func init() {
	Register(unicornRequireModuleAttributes{})
}
