package main

import (
  "sort"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// format/sort-imports orders the file's top-level import declarations into
// canonical groups and alphabetizes each group. Compatible-by-spirit with
// `@trivago/prettier-plugin-sort-imports`, but the MVP runs on a hard-coded
// two-group scheme:
//
//   1. External modules (specifier does not start with `.`).
//   2. Relative modules (specifier starts with `.`).
//
// Groups are separated by exactly one blank line. Within each group,
// declarations are sorted by their module-specifier text (ASCII order).
// Named specifiers inside each declaration are alphabetized too.
//
// Safety policy: if any byte between the contiguous imports is not
// whitespace, the rule bails. Comments anchored to specific imports would
// otherwise move with the wrong declaration, which is a strictly worse
// outcome than declining to sort.
//
// Side-effect imports (`import "foo"`), namespace imports
// (`import * as ns from`), default imports, and `import type` all
// participate in the same group based on their module specifier.
type formatSortImports struct{}

func (formatSortImports) Name() string     { return "format/sort-imports" }
func (formatSortImports) IsFormat() bool   { return true }
func (formatSortImports) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}

func (formatSortImports) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil {
    return
  }
  src := ctx.File.Text()
  statements := ctx.File.Statements
  if statements == nil {
    return
  }
  imports := collectLeadingImports(statements.Nodes)
  if len(imports) >= 2 {
    if !leadingTriviaIsAllWhitespace(src, imports) {
      // Preserve user-attached comments by declining to sort.
    } else {
      // Where to splice: from the first import's actual token start
      // (after any file-scope leading comments) to the last import's
      // end position.
      first := imports[0]
      last := imports[len(imports)-1]
      replaceStart := shimscanner.SkipTrivia(src, first.Pos())
      replaceEnd := last.End()
      original := src[replaceStart:replaceEnd]
      rebuilt := buildSortedImportBlock(src, imports)
      if rebuilt != original {
        ctx.ReportRangeFix(
          replaceStart,
          replaceEnd,
          "Imports must be sorted into canonical groups.",
          TextEdit{Pos: replaceStart, End: replaceEnd, Text: rebuilt},
        )
        return
      }
    }
  }
  // Specifier-level pass: sort named import specifiers within each
  // declaration. This pass runs independently of the block-level pass
  // so a file that is already sorted at the declaration level can still
  // benefit from internal specifier ordering.
  for _, decl := range collectLeadingImports(statements.Nodes) {
    reportNamedSpecifierSort(ctx, decl)
  }
}

// collectLeadingImports walks the file's statement list and returns the
// contiguous run of ImportDeclaration nodes at its head. Stops at the
// first non-import statement because moving an import across an
// expression statement could change runtime evaluation order.
func collectLeadingImports(stmts []*shimast.Node) []*shimast.Node {
  out := make([]*shimast.Node, 0)
  for _, stmt := range stmts {
    if stmt == nil || stmt.Kind != shimast.KindImportDeclaration {
      break
    }
    out = append(out, stmt)
  }
  return out
}

// leadingTriviaIsAllWhitespace returns true when the source between each
// adjacent import declaration contains no comment bytes. Comments anchor
// the rule into a no-op because moving imports could mis-attach them.
func leadingTriviaIsAllWhitespace(src string, imports []*shimast.Node) bool {
  for i := 1; i < len(imports); i++ {
    prevEnd := imports[i-1].End()
    currStart := shimscanner.SkipTrivia(src, imports[i].Pos())
    for j := prevEnd; j < currStart; j++ {
      c := src[j]
      if c != ' ' && c != '\t' && c != '\r' && c != '\n' {
        return false
      }
    }
  }
  return true
}

// buildSortedImportBlock returns the canonical group/sort representation of
// the contiguous import declarations.
func buildSortedImportBlock(src string, imports []*shimast.Node) string {
  type entry struct {
    isRelative bool
    specifier  string
    text       string
  }
  entries := make([]entry, 0, len(imports))
  for _, decl := range imports {
    spec := moduleSpecifierText(decl)
    text := importStatementText(src, decl)
    entries = append(entries, entry{
      isRelative: isRelativeModuleSpecifier(spec),
      specifier:  spec,
      text:       text,
    })
  }
  sort.SliceStable(entries, func(i, j int) bool {
    if entries[i].isRelative != entries[j].isRelative {
      // External first, relative second.
      return !entries[i].isRelative
    }
    return entries[i].specifier < entries[j].specifier
  })

  var b strings.Builder
  prevRelative := entries[0].isRelative
  for i, e := range entries {
    if i > 0 {
      if e.isRelative != prevRelative {
        b.WriteString("\n\n")
      } else {
        b.WriteString("\n")
      }
    }
    b.WriteString(e.text)
    prevRelative = e.isRelative
  }
  return b.String()
}

// importStatementText returns the import declaration's source text,
// stripped of any leading whitespace/comment trivia.
func importStatementText(src string, decl *shimast.Node) string {
  start := shimscanner.SkipTrivia(src, decl.Pos())
  end := decl.End()
  if start < 0 || start > end || end > len(src) {
    return ""
  }
  return src[start:end]
}

// moduleSpecifierText returns the unquoted module specifier of an
// ImportDeclaration, or "" when the AST shape is unexpected.
func moduleSpecifierText(decl *shimast.Node) string {
  if decl == nil {
    return ""
  }
  imp := decl.AsImportDeclaration()
  if imp == nil || imp.ModuleSpecifier == nil {
    return ""
  }
  return stringLiteralText(imp.ModuleSpecifier)
}

func isRelativeModuleSpecifier(specifier string) bool {
  return strings.HasPrefix(specifier, ".")
}

// specifierEntry is the sortable pair captured for each named import
// specifier: the identifier used as the sort key and the literal source
// text that gets re-emitted in canonical order.
type specifierEntry struct {
  key  string
  text string
}

// reportNamedSpecifierSort reports a fix when an import's `{ a, b }` list
// is out of alphabetical order. Type-only specifiers participate in the
// same sort key as value specifiers — prettier's plugin-sort-imports
// matches this behavior.
func reportNamedSpecifierSort(ctx *Context, decl *shimast.Node) {
  imp := decl.AsImportDeclaration()
  if imp == nil || imp.ImportClause == nil {
    return
  }
  clause := imp.ImportClause.AsImportClause()
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
  src := ctx.File.Text()
  specifiers := named.Elements.Nodes

  entries := make([]specifierEntry, 0, len(specifiers))
  for _, spec := range specifiers {
    if spec == nil {
      continue
    }
    s := spec.AsImportSpecifier()
    if s == nil {
      return // unexpected shape; bail
    }
    name := identifierText(s.Name())
    if name == "" {
      return
    }
    start := shimscanner.SkipTrivia(src, spec.Pos())
    end := spec.End()
    entries = append(entries, specifierEntry{
      key:  name,
      text: src[start:end],
    })
  }
  if len(entries) < 2 {
    return
  }
  sorted := make([]specifierEntry, len(entries))
  copy(sorted, entries)
  sort.SliceStable(sorted, func(i, j int) bool {
    return sorted[i].key < sorted[j].key
  })
  changed := false
  for i := range entries {
    if entries[i].key != sorted[i].key {
      changed = true
      break
    }
  }
  if !changed {
    return
  }
  firstStart := shimscanner.SkipTrivia(src, specifiers[0].Pos())
  lastEnd := specifiers[len(specifiers)-1].End()
  rebuilt := joinSortedSpecifiers(sorted)
  if src[firstStart:lastEnd] == rebuilt {
    return
  }
  ctx.ReportRangeFix(
    firstStart,
    lastEnd,
    "Named import specifiers must be sorted alphabetically.",
    TextEdit{Pos: firstStart, End: lastEnd, Text: rebuilt},
  )
}

func joinSortedSpecifiers(entries []specifierEntry) string {
  texts := make([]string, len(entries))
  for i, e := range entries {
    texts[i] = e.text
  }
  return strings.Join(texts, ", ")
}

func init() {
  Register(formatSortImports{})
}
