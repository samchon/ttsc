// no-empty-named-blocks: empty `{}` clauses on import or export
// declarations bind nothing and almost always indicate a mid-edit
// mistake or a leftover marker. ESLint suggestions / extra-rules:
// https://eslint.org/docs/latest/rules/no-empty-named-blocks
//
// Three shapes fire the rule:
//
//   - `import {} from "x"` — only the side-effect load remains; write
//     `import "x"` instead if that is the intent.
//   - `import name, {} from "x"` — once a default binding is present the
//     `{}` adds nothing; drop the empty clause.
//   - `export {}` — restates module-ness redundantly, or marks an
//     otherwise non-module file in a way that has cleaner alternatives
//     (`no-useless-empty-export` is the stricter sibling that fires
//     only when another module-syntax statement is already present).
//
// AST-only; the rule never consults the Checker.
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type noEmptyNamedBlocks struct{}

func (noEmptyNamedBlocks) Name() string { return "no-empty-named-blocks" }
func (noEmptyNamedBlocks) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindImportDeclaration, shimast.KindExportDeclaration}
}
func (noEmptyNamedBlocks) Check(ctx *Context, node *shimast.Node) {
  switch node.Kind {
  case shimast.KindImportDeclaration:
    noEmptyNamedBlocksCheckImport(ctx, node)
  case shimast.KindExportDeclaration:
    noEmptyNamedBlocksCheckExport(ctx, node)
  }
}

// noEmptyNamedBlocksCheckImport flags `import {} from "x"` and
// `import name, {} from "x"`. The empty-clause-only form should become
// a bare `import "x"`; the default-plus-empty form should drop the
// empty clause and keep the default binding.
func noEmptyNamedBlocksCheckImport(ctx *Context, node *shimast.Node) {
  decl := node.AsImportDeclaration()
  if decl == nil || decl.ImportClause == nil {
    return
  }
  clause := decl.ImportClause.AsImportClause()
  if clause == nil {
    return
  }
  if clause.NamedBindings == nil {
    return
  }
  if clause.NamedBindings.Kind != shimast.KindNamedImports {
    return
  }
  named := clause.NamedBindings.AsNamedImports()
  if named == nil || named.Elements == nil || len(named.Elements.Nodes) > 0 {
    return
  }
  // Two shapes both reach here:
  //   `import {} from "x"`           — clause.Name() == nil
  //   `import name, {} from "x"`     — clause.Name() != nil
  // Either way the empty `{}` is what the rule blames; the report
  // target is the empty named-imports node so the highlight points at
  // the `{}` token, not the whole declaration.
  ctx.Report(clause.NamedBindings, "Unexpected empty named import block.")
}

// noEmptyNamedBlocksCheckExport flags `export {}` (with or without a
// `from "x"` source). The form is always rewritable to either nothing
// or a bare side-effect `import "x"`; the rule's role is to surface it
// uniformly across both module and non-module sources, leaving
// `no-useless-empty-export` to gate the narrower redundant-marker case.
func noEmptyNamedBlocksCheckExport(ctx *Context, node *shimast.Node) {
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
  ctx.Report(node, "Unexpected empty named export block.")
}

func init() {
  Register(noEmptyNamedBlocks{})
}
