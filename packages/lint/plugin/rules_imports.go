package main

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// no-import-type-side-effects: an import whose every named specifier
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
    // Locate the `type` keyword token at the head of the specifier by
    // first skipping leading trivia (whitespace + comments). A naive
    // `findKeyword` would search the byte range linearly and could
    // match `type` *inside* a leading block comment such as
    // `/* type alias */`, deleting the comment text and corrupting
    // the source. SkipTrivia honors the lexer's notion of trivia, so
    // the post-skip position is the actual first token byte.
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

func init() {
  Register(noImportTypeSideEffects{})
}
