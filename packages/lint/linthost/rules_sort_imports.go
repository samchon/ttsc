// sortImports reports import declarations whose named specifier list is
// not alphabetically ordered. Per-declaration only: ordering of import
// declarations relative to each other is the `format/sort-imports` rule's
// concern. This rule looks inside one `{ a, b, c }` block and flags the
// first specifier that breaks the sort.
//
// The local binding name is the sort key. For `import { a as z } from "x"`
// the rule reads `z`, mirroring ESLint's `memberSyntaxSortOrder` group
// behavior (and `ignoreCase` is intentionally not implemented; the
// conservative baseline is byte-order ASCII sort).
//
// Specifiers with no usable identifier (defensive: malformed parse)
// short-circuit the check for that declaration; the rule emits a single
// finding for the first out-of-order specifier and stops, matching
// ESLint's per-declaration behavior.
//
// https://eslint.org/docs/latest/rules/sort-imports
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type sortImports struct{}

func (sortImports) Name() string { return "sort-imports" }
func (sortImports) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindImportDeclaration}
}
func (sortImports) Check(ctx *Context, node *shimast.Node) {
	decl := node.AsImportDeclaration()
	if decl == nil || decl.ImportClause == nil {
		return
	}
	clause := decl.ImportClause.AsImportClause()
	if clause == nil || clause.NamedBindings == nil {
		return
	}
	if clause.NamedBindings.Kind != shimast.KindNamedImports {
		return
	}
	named := clause.NamedBindings.AsNamedImports()
	if named == nil || named.Elements == nil || len(named.Elements.Nodes) < 2 {
		return
	}
	previous := ""
	for i, spec := range named.Elements.Nodes {
		if spec == nil {
			return
		}
		s := spec.AsImportSpecifier()
		if s == nil {
			return
		}
		name := identifierText(s.Name())
		if name == "" {
			return
		}
		if i > 0 && name < previous {
			ctx.Report(spec, "Member '"+name+"' of the import declaration should be sorted alphabetically.")
			return
		}
		previous = name
	}
}

func init() {
	Register(sortImports{})
}
