package demo

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/lint/rule"
)

func init() {
  rule.Register(capitalizeExports{})
}

// capitalizeExports flags `export const foo = …` whose identifier starts
// with a lowercase ASCII letter and offers a single-byte autofix that
// replaces that first byte with its uppercase form. The rule exists to
// exercise the contributor `ReportRangeFix` path end-to-end (host
// adapter → engine → fix cascade → disk write); it is deliberately
// distinct from every built-in rule so the test assertion is unambiguous.
type capitalizeExports struct{}

func (capitalizeExports) Name() string { return "demo/capitalize-exports" }

func (capitalizeExports) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindVariableStatement}
}

func (capitalizeExports) Check(ctx *rule.Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil {
    return
  }
  stmt := node.AsVariableStatement()
  if stmt == nil {
    return
  }
  if !hasExportKeyword(stmt.Modifiers()) {
    return
  }
  if stmt.DeclarationList == nil {
    return
  }
  list := stmt.DeclarationList.AsVariableDeclarationList()
  if list == nil || list.Declarations == nil {
    return
  }
  for _, decl := range list.Declarations.Nodes {
    d := decl.AsVariableDeclaration()
    if d == nil {
      continue
    }
    name := d.Name()
    if name == nil || name.Kind != shimast.KindIdentifier {
      continue
    }
    id := name.AsIdentifier()
    if id == nil || id.Text == "" {
      continue
    }
    first := id.Text[0]
    if first < 'a' || first > 'z' {
      continue
    }
    pos := name.Pos()
    // Skip leading trivia; the identifier's Pos can point inside
    // surrounding whitespace.
    src := ctx.File.Text()
    for pos < len(src) && (src[pos] == ' ' || src[pos] == '\t' || src[pos] == '\n' || src[pos] == '\r') {
      pos++
    }
    if pos >= len(src) || src[pos] != first {
      continue
    }
    upper := string(first - 'a' + 'A')
    ctx.ReportRangeFix(
      pos,
      pos+1,
      "Exported `const` identifiers must start with an uppercase letter.",
      rule.TextEdit{Pos: pos, End: pos + 1, Text: upper},
    )
  }
}

func hasExportKeyword(mods *shimast.ModifierList) bool {
  if mods == nil {
    return false
  }
  for _, m := range mods.Nodes {
    if m != nil && m.Kind == shimast.KindExportKeyword {
      return true
    }
  }
  return false
}
