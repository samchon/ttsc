// unicorn/require-module-specifiers: an `import "x"` with no bindings
// or an `export {} from "x"` declares the module dependency without
// pulling anything from it; both shapes are almost always either dead
// imports left over from a refactor or accidental side-effect imports
// that the author meant to bind. The rule asks for an explicit specifier
// list so the dependency makes its purpose visible in the source.
//
// AST-only: visit every `ImportDeclaration` and `ExportDeclaration`.
// Import side fires when the declaration has no `ImportClause` at all
// (the side-effect form). Export side fires when the declaration has an
// empty NamedExports `{}` (with or without a `from`).
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/require-module-specifiers.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornRequireModuleSpecifiers struct{}

func (unicornRequireModuleSpecifiers) Name() string {
	return "unicorn/require-module-specifiers"
}
func (unicornRequireModuleSpecifiers) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindImportDeclaration, shimast.KindExportDeclaration}
}
func (unicornRequireModuleSpecifiers) Check(ctx *Context, node *shimast.Node) {
	switch node.Kind {
	case shimast.KindImportDeclaration:
		decl := node.AsImportDeclaration()
		if decl == nil {
			return
		}
		// `import "x"` parses with a nil ImportClause; any binding shape
		// (`import x`, `import {a}`, `import * as ns`) installs a clause.
		if decl.ImportClause == nil {
			ctx.Report(node, "Empty import/export specifier list is not allowed.")
		}
	case shimast.KindExportDeclaration:
		decl := node.AsExportDeclaration()
		if decl == nil || decl.ExportClause == nil {
			return
		}
		if decl.ExportClause.Kind != shimast.KindNamedExports {
			return
		}
		named := decl.ExportClause.AsNamedExports()
		if named == nil || named.Elements == nil || len(named.Elements.Nodes) > 0 {
			return
		}
		ctx.Report(node, "Empty import/export specifier list is not allowed.")
	}
}

func init() {
	Register(unicornRequireModuleSpecifiers{})
}
