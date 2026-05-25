package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// printNamedImports renders `{ a, b, c }` inside an import declaration.
// Each specifier flows through PrintNode, so `a as b` shapes that the
// dispatcher does not understand yet still print verbatim.
//
// Flat:    `{ a, b, c }`
//
//  Broken:  `{
//              a,
//              b,
//              c,
//           }`
//
// The open/close braces always carry a single space inside in flat
// mode, matching Prettier's `bracketSpacing: true` default for import
// declarations (which is hard-coded; Prettier ignores `bracketSpacing`
// for imports). Empty named imports `{}` collapse cleanly.
//
// The second return value is the `covered` flag: see PrintNode.
func printNamedImports(ctx *PrintContext, node *shimast.Node) (Doc, bool) {
  if node == nil {
    return Doc{}, true
  }
  ni := node.AsNamedImports()
  if ni == nil || ni.Elements == nil {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  items := make([]Doc, 0, len(ni.Elements.Nodes))
  covered := true
  for _, spec := range ni.Elements.Nodes {
    if spec == nil {
      return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
    }
    doc, childCovered := PrintNode(ctx, spec)
    covered = covered && childCovered
    items = append(items, doc)
  }
  // AddComma honors `format.trailingComma`: named imports are an
  // ES5-permitted comma position, so "all" and "es5" both keep the
  // trailing comma; only "none" drops it.
  return printList(ctx, listShape{
    OpenTok:  "{",
    CloseTok: "}",
    Items:    items,
    Space:    true,
    AddComma: ctx.allowsEs5TrailingComma(),
  }), covered
}

// printNamedExports renders `export { a, b }`. The shape is identical
// to NamedImports; only the surrounding declaration differs.
//
// The second return value is the `covered` flag: see PrintNode.
func printNamedExports(ctx *PrintContext, node *shimast.Node) (Doc, bool) {
  if node == nil {
    return Doc{}, true
  }
  ne := node.AsNamedExports()
  if ne == nil || ne.Elements == nil {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  items := make([]Doc, 0, len(ne.Elements.Nodes))
  covered := true
  for _, spec := range ne.Elements.Nodes {
    if spec == nil {
      return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
    }
    doc, childCovered := PrintNode(ctx, spec)
    covered = covered && childCovered
    items = append(items, doc)
  }
  // AddComma honors `format.trailingComma`: named exports are an
  // ES5-permitted comma position, so "all" and "es5" both keep the
  // trailing comma; only "none" drops it.
  return printList(ctx, listShape{
    OpenTok:  "{",
    CloseTok: "}",
    Items:    items,
    Space:    true,
    AddComma: ctx.allowsEs5TrailingComma(),
  }), covered
}

// printImportDeclaration renders the surrounding `import … from "x";`.
// The default specifier, namespace import, named-imports clause, and
// module specifier are all individually dispatched so the named-imports
// portion can reflow while the rest stays verbatim.
//
// The dispatcher hands off to the per-clause printers; the top-level
// frame stitches them together with the keywords and `from` token.
//
// The second return value is the `covered` flag: see PrintNode.
func printImportDeclaration(ctx *PrintContext, node *shimast.Node) (Doc, bool) {
  if node == nil {
    return Doc{}, true
  }
  imp := node.AsImportDeclaration()
  if imp == nil {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  // If the declaration uses anything other than a vanilla
  // `import { ... } from "x"` shape (default specifier, namespace
  // alias, attributes clause, etc.), fall back to verbatim. The
  // canonical reflow target is the named-import body.
  clause := imp.ImportClause
  if clause == nil {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  clauseData := clause.AsImportClause()
  if clauseData == nil || clauseData.NamedBindings == nil {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  if clauseData.NamedBindings.Kind != shimast.KindNamedImports {
    // Namespace imports (`import * as ns from "x"`) have no
    // reflow surface; leave them alone.
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  if clause.Name() != nil {
    // `import Default, { … } from "x"` — keep verbatim for v1.
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  // AttributeClause (`with { ... }` / `assert { ... }`) lives after
  // the module specifier. Fall back to verbatim when present so we
  // don't drop attributes silently.
  if imp.Attributes != nil {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }

  // Bracketed clause prefix: `import ` (and optional `type `).
  prefix := "import "
  if clause.IsTypeOnly() {
    prefix = "import type "
  }
  named, covered := PrintNode(ctx, clauseData.NamedBindings)
  moduleSpec := verbatim(ctx, imp.ModuleSpecifier)
  covered = covered && !nodeSpansMultipleLines(ctx, imp.ModuleSpecifier)
  parts := []Doc{Text(prefix), named, Text(" from "), moduleSpec}
  if sourceHasStatementTerminator(ctx.Source, node.End()) {
    // Preserve the user's terminator decision. Emitting `;`
    // unconditionally would collide with `format/semi`'s
    // zero-width insert on the same cascade pass and produce
    // `;;` — `format/semi` owns terminator placement.
    parts = append(parts, Text(";"))
  }
  return Concat(parts...), covered
}

// sourceHasStatementTerminator reports whether the last non-trivia
// byte at or before `end` is `;`. TypeScript-Go's parser folds an
// optional trailing semicolon into the statement's End(), so this
// check tells the printer whether the user wrote one.
//
// Trailing block comments (`import { … } from "x" /* tail */;`) sit
// between the module specifier and the `;`. The backward walk must
// step past them; otherwise the helper sees `/` from `*/` and
// concludes "no terminator".
func sourceHasStatementTerminator(src string, end int) bool {
  i := end - 1
  for i >= 0 {
    c := src[i]
    if c == ' ' || c == '\t' || c == '\r' || c == '\n' {
      i--
      continue
    }
    if c == ';' {
      return true
    }
    // Skip a trailing block comment: walk back past `*/`...`/*`.
    if c == '/' && i-1 >= 0 && src[i-1] == '*' {
      j := i - 2
      for j-1 >= 0 && !(src[j-1] == '/' && src[j] == '*') {
        j--
      }
      if j-1 < 0 {
        return false
      }
      i = j - 2
      continue
    }
    return false
  }
  return false
}
