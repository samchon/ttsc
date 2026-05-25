package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// noImportTypeSideEffects: an import whose every named specifier
// uses the inline `type` modifier is morally a type-only import; hoist
// the `type` to the import clause to make that intent explicit and let
// `verbatimModuleSyntax` elide the import entirely. typescript-eslint
// stylistic: https://typescript-eslint.io/rules/no-import-type-side-effects/
type noImportTypeSideEffects struct{}

func (noImportTypeSideEffects) Name() string { return "no-import-type-side-effects" }
func (noImportTypeSideEffects) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindImportDeclaration}
}
func (noImportTypeSideEffects) Check(ctx *Context, node *shimast.Node) {
  decl := node.AsImportDeclaration()
  if decl == nil || decl.ImportClause == nil {
    return
  }
  clause := decl.ImportClause.AsImportClause()
  if clause == nil {
    return
  }
  // `import type { … }` already hoists the modifier; nothing to do.
  if clause.PhaseModifier == shimast.KindTypeKeyword {
    return
  }
  // The rule only applies to named imports; default imports cannot
  // carry an inline `type` modifier.
  if clause.NamedBindings == nil || clause.NamedBindings.Kind != shimast.KindNamedImports {
    return
  }
  // A clause with a default binding alongside named imports is a
  // mixed import; hoisting `type` would change semantics for the
  // default. Skip.
  if clause.Name() != nil {
    return
  }
  named := clause.NamedBindings.AsNamedImports()
  if named == nil || named.Elements == nil || len(named.Elements.Nodes) == 0 {
    return
  }
  for _, spec := range named.Elements.Nodes {
    s := spec.AsImportSpecifier()
    if s == nil || !s.IsTypeOnly {
      return
    }
  }
  message := "Use top-level `import type` instead of marking every specifier individually."
  // Compute edits: insert ` type` after the leading `import` keyword,
  // then delete each specifier's `type ` prefix. All edits must be
  // non-overlapping; the keyword insertion is at offset 6 (after
  // `import`), and each specifier-level delete is strictly inside the
  // braces, so they never overlap.
  importKwEnd := findKeyword(ctx.File, node.Pos(), node.End(), "import")
  if importKwEnd < 0 {
    ctx.Report(node, message)
    return
  }
  importKwEnd += len("import")
  edits := []TextEdit{
    {Pos: importKwEnd, End: importKwEnd, Text: " type"},
  }
  src := ctx.File.Text()
  for _, spec := range named.Elements.Nodes {
    // Locate the `type` keyword token at the head of each specifier by
    // skipping leading trivia (whitespace + comments). A naive
    // findKeyword scan would risk matching `type` inside a block comment
    // such as `/* type alias */`, corrupting the source. SkipTrivia
    // anchors the scan at the actual first token byte.
    typePos := shimscanner.SkipTrivia(src, spec.Pos())
    if typePos < 0 || typePos+len("type") > len(src) {
      continue
    }
    if src[typePos:typePos+len("type")] != "type" {
      continue
    }
    after := typePos + len("type")
    // Defensive: ensure the keyword is followed by a non-identifier byte
    // — otherwise we'd be matching an identifier prefix like `typeOf`.
    if after < len(src) && isIdentifierPart(src[after]) {
      continue
    }
    deleteEnd := after
    if deleteEnd < len(src) && (src[deleteEnd] == ' ' || src[deleteEnd] == '\t') {
      deleteEnd++
    }
    edits = append(edits, TextEdit{Pos: typePos, End: deleteEnd, Text: ""})
  }
  ctx.ReportFix(node, message, edits...)
}

// noUselessEmptyExport: `export {}` is only useful as a module marker.
// Once a file or namespace block already contains another import/export,
// the empty export does not change module-ness and can be removed.
type noUselessEmptyExport struct{}

func (noUselessEmptyExport) Name() string { return "no-useless-empty-export" }
func (noUselessEmptyExport) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile, shimast.KindModuleBlock}
}
func (noUselessEmptyExport) Check(ctx *Context, node *shimast.Node) {
  if ctx.File != nil && ctx.File.IsDeclarationFile {
    return
  }
  statements := node.Statements()
  if len(statements) == 0 {
    return
  }
  emptyExports := []*shimast.Node{}
  foundOtherModuleSyntax := false
  for _, stmt := range statements {
    if stmt == nil {
      continue
    }
    if isEmptyExportDeclaration(stmt) {
      emptyExports = append(emptyExports, stmt)
      continue
    }
    if isModuleSyntaxStatement(stmt) {
      foundOtherModuleSyntax = true
    }
  }
  if !foundOtherModuleSyntax {
    return
  }
  for _, stmt := range emptyExports {
    ctx.Report(stmt, "Empty export does not change module-ness here.")
  }
}

func isEmptyExportDeclaration(node *shimast.Node) bool {
  if node == nil || node.Kind != shimast.KindExportDeclaration {
    return false
  }
  decl := node.AsExportDeclaration()
  if decl == nil || decl.ExportClause == nil || decl.ModuleSpecifier != nil {
    return false
  }
  if decl.ExportClause.Kind != shimast.KindNamedExports {
    return false
  }
  named := decl.ExportClause.AsNamedExports()
  return named != nil && (named.Elements == nil || len(named.Elements.Nodes) == 0)
}

func isModuleSyntaxStatement(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindImportDeclaration, shimast.KindImportEqualsDeclaration, shimast.KindExportAssignment:
    return true
  case shimast.KindExportDeclaration:
    return !isEmptyExportDeclaration(node)
  }
  return hasModifier(node, shimast.KindExportKeyword)
}

func init() {
  Register(noImportTypeSideEffects{})
  Register(noUselessEmptyExport{})
}
