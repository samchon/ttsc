// AST-only baseline of typescript-eslint's `consistent-type-exports`.
//
// The rule wants `export { Foo }` rewritten to `export type { Foo }`
// when every exported name is a type-only declaration (interface or
// type alias). Without the `type` modifier the import side sees a
// value re-export and the bundler keeps a runtime binding for what is
// really a compile-time-only symbol.
//
// Without the Checker the rule cannot reach across modules to confirm
// the exported name is type-only at its source. The conservative
// AST-only baseline matches only intra-file exports: an
// `export { Foo, Bar }` with no module specifier whose every name is
// declared in the same file as an `interface` or `type` alias and
// nowhere as a value (variable / function / class / enum).
// https://typescript-eslint.io/rules/consistent-type-exports/
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type consistentTypeExports struct{}

func (consistentTypeExports) Name() string { return "typescript/consistent-type-exports" }
func (consistentTypeExports) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindExportDeclaration}
}
func (consistentTypeExports) Check(ctx *Context, node *shimast.Node) {
	decl := node.AsExportDeclaration()
	if decl == nil || decl.ExportClause == nil {
		return
	}
	// Already `export type { ... }` — nothing to suggest.
	if decl.IsTypeOnly {
		return
	}
	// Re-export from another module (`export { Foo } from "bar"`)
	// cannot be classified by the AST alone — the source's nature
	// lives in a different file. Skip to stay conservative.
	if decl.ModuleSpecifier != nil {
		return
	}
	if decl.ExportClause.Kind != shimast.KindNamedExports {
		return
	}
	named := decl.ExportClause.AsNamedExports()
	if named == nil || named.Elements == nil || len(named.Elements.Nodes) == 0 {
		return
	}
	// Collect the local names being exported. `export { Foo as Bar }`
	// — the `propertyName` (Foo) is the local identifier; the `name`
	// (Bar) is the externally visible alias.
	localNames := []string{}
	for _, el := range named.Elements.Nodes {
		spec := el.AsExportSpecifier()
		if spec == nil {
			return
		}
		// An inline `export { type Foo }` already opts out at the
		// specifier level — bail rather than try to merge mixed shapes.
		if spec.IsTypeOnly {
			return
		}
		local := spec.PropertyName
		if local == nil {
			local = spec.Name()
		}
		name := identifierText(local)
		if name == "" {
			return
		}
		localNames = append(localNames, name)
	}
	if len(localNames) == 0 {
		return
	}
	if !allNamesAreTypeOnlyDeclarations(ctx.File, localNames) {
		return
	}
	ctx.Report(node, "All exported names are type-only declarations — prefer `export type { ... }` so consumers and bundlers can elide the import.")
}

// allNamesAreTypeOnlyDeclarations reports whether every name in
// `names` is declared in `file` exclusively as a type (interface or
// type alias) and never as a value (variable / function / class /
// enum / namespace / module / import binding). A name that has no
// declaration in the file at all also returns false — without the
// Checker the rule cannot prove the binding is type-only when its
// source is elsewhere.
func allNamesAreTypeOnlyDeclarations(file *shimast.SourceFile, names []string) bool {
	if file == nil || file.Statements == nil || len(names) == 0 {
		return false
	}
	want := map[string]bool{}
	for _, n := range names {
		want[n] = true
	}
	found := map[string]bool{}
	valueShadow := map[string]bool{}
	for _, stmt := range file.Statements.Nodes {
		if stmt == nil {
			continue
		}
		switch stmt.Kind {
		case shimast.KindInterfaceDeclaration:
			decl := stmt.AsInterfaceDeclaration()
			if decl == nil {
				continue
			}
			name := identifierText(decl.Name())
			if want[name] {
				found[name] = true
			}
		case shimast.KindTypeAliasDeclaration:
			decl := stmt.AsTypeAliasDeclaration()
			if decl == nil {
				continue
			}
			name := identifierText(decl.Name())
			if want[name] {
				found[name] = true
			}
		case shimast.KindVariableStatement:
			vs := stmt.AsVariableStatement()
			if vs == nil || vs.DeclarationList == nil {
				continue
			}
			list := vs.DeclarationList.AsVariableDeclarationList()
			if list == nil || list.Declarations == nil {
				continue
			}
			for _, d := range list.Declarations.Nodes {
				if d == nil {
					continue
				}
				vd := d.AsVariableDeclaration()
				if vd == nil {
					continue
				}
				if name := identifierText(vd.Name()); want[name] {
					valueShadow[name] = true
				}
			}
		case shimast.KindFunctionDeclaration:
			fn := stmt.AsFunctionDeclaration()
			if fn == nil {
				continue
			}
			if name := identifierText(fn.Name()); want[name] {
				valueShadow[name] = true
			}
		case shimast.KindClassDeclaration:
			cd := stmt.AsClassDeclaration()
			if cd == nil {
				continue
			}
			if name := identifierText(cd.Name()); want[name] {
				valueShadow[name] = true
			}
		case shimast.KindEnumDeclaration:
			ed := stmt.AsEnumDeclaration()
			if ed == nil {
				continue
			}
			if name := identifierText(ed.Name()); want[name] {
				valueShadow[name] = true
			}
		case shimast.KindModuleDeclaration:
			// `namespace Foo { ... }` and `module "foo" { ... }` both
			// produce a value binding for the namespace object.
			md := stmt.AsModuleDeclaration()
			if md == nil {
				continue
			}
			if name := identifierText(md.Name()); want[name] {
				valueShadow[name] = true
			}
		case shimast.KindImportDeclaration:
			// Any name that comes in through a value import is a value
			// here, so the export rewrite would be wrong.
			collectImportBindings(stmt, want, valueShadow)
		case shimast.KindImportEqualsDeclaration:
			ied := stmt.AsImportEqualsDeclaration()
			if ied == nil {
				continue
			}
			if name := identifierText(ied.Name()); want[name] {
				valueShadow[name] = true
			}
		}
	}
	for _, n := range names {
		if valueShadow[n] || !found[n] {
			return false
		}
	}
	return true
}

// collectImportBindings records every value-import name from `stmt`
// into `valueShadow` if it appears in `want`. Type-only imports
// (`import type { Foo }` or inline `import { type Foo }`) do not
// produce a value binding and are skipped.
func collectImportBindings(stmt *shimast.Node, want, valueShadow map[string]bool) {
	if stmt == nil {
		return
	}
	decl := stmt.AsImportDeclaration()
	if decl == nil || decl.ImportClause == nil {
		return
	}
	clause := decl.ImportClause.AsImportClause()
	if clause == nil {
		return
	}
	// `import type { Foo }` — entire clause is type-only.
	if clause.PhaseModifier == shimast.KindTypeKeyword {
		return
	}
	if def := clause.Name(); def != nil {
		if name := identifierText(def); want[name] {
			valueShadow[name] = true
		}
	}
	if clause.NamedBindings == nil {
		return
	}
	switch clause.NamedBindings.Kind {
	case shimast.KindNamespaceImport:
		ns := clause.NamedBindings.AsNamespaceImport()
		if ns == nil {
			return
		}
		if name := identifierText(ns.Name()); want[name] {
			valueShadow[name] = true
		}
	case shimast.KindNamedImports:
		named := clause.NamedBindings.AsNamedImports()
		if named == nil || named.Elements == nil {
			return
		}
		for _, spec := range named.Elements.Nodes {
			s := spec.AsImportSpecifier()
			if s == nil || s.IsTypeOnly {
				continue
			}
			if name := identifierText(s.Name()); want[name] {
				valueShadow[name] = true
			}
		}
	}
}

func init() {
	Register(consistentTypeExports{})
}
