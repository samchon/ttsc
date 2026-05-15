package main

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// format/print-width reflows expressions and declarations so they fit
// within a `printWidth`-column budget, mirroring Prettier's headline
// formatting feature.
//
// Coverage in v1 is intentionally narrow: the rule activates on the
// node kinds whose per-node printers are registered with the
// dispatcher (object/array literals, call/new expressions, named
// import / export clauses, top-level import declarations). For every
// other kind, the rule abstains — it never emits an edit that would
// modify bytes the dispatcher does not fully control. Coverage
// expands by adding kinds to the dispatcher; the rule itself does not
// need to grow.
//
// Per-node decision flow:
//
//  1. Skip leading trivia to find the node's actual first byte.
//  2. Count the leading column on that line — that becomes the
//     printer's StartingIndent so continuation lines align under the
//     opening token and fit measurement charges the prefix against
//     the budget.
//  3. Build the node's Doc via PrintNode.
//  4. Render with the configured printWidth / tabWidth / useTabs /
//     endOfLine.
//  5. Slice the original source bytes for the node's range.
//  6. If the rendered output differs, emit one TextEdit replacing
//     [start, end) with the new bytes.
//
// The "no diff → no edit" invariant is what keeps `ttsc format`
// idempotent: a second pass renders identical bytes, the comparison
// short-circuits, and the cascade converges.
//
// The rule is a format-class rule (IsFormat == true) so `ttsc format`
// applies its edits while `ttsc check` only emits diagnostics for
// configured severities. Reuses the `error` severity caveat from
// other format rules: only set `error` once the full reflow coverage
// is mature.
type formatPrintWidth struct{}

// formatPrintWidthOptions mirrors `TtscLintRuleOptions.PrintWidth`.
type formatPrintWidthOptions struct {
  PrintWidth *int    `json:"printWidth"`
  TabWidth   *int    `json:"tabWidth"`
  UseTabs    *bool   `json:"useTabs"`
  EndOfLine  *string `json:"endOfLine"`
}

func (formatPrintWidth) Name() string   { return "format/print-width" }
func (formatPrintWidth) IsFormat() bool { return true }

func (formatPrintWidth) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindObjectLiteralExpression,
    shimast.KindArrayLiteralExpression,
    shimast.KindCallExpression,
    shimast.KindNewExpression,
    shimast.KindNamedImports,
    shimast.KindNamedExports,
    shimast.KindImportDeclaration,
  }
}

func (formatPrintWidth) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || node == nil {
    return
  }
  var opts formatPrintWidthOptions
  _ = ctx.DecodeOptions(&opts)
  printOpts := DefaultPrintOptions()
  if opts.PrintWidth != nil && *opts.PrintWidth > 0 {
    printOpts.PrintWidth = *opts.PrintWidth
  }
  if opts.TabWidth != nil && *opts.TabWidth > 0 {
    printOpts.TabWidth = *opts.TabWidth
  }
  if opts.UseTabs != nil {
    printOpts.UseTabs = *opts.UseTabs
  }
  if opts.EndOfLine != nil {
    printOpts.EndOfLine = *opts.EndOfLine
  }

  src := ctx.File.Text()
  start := shimscanner.SkipTrivia(src, node.Pos())
  end := node.End()
  if start < 0 || end <= start || end > len(src) {
    return
  }

  // Skip nested-print fires: if the visiting node has an ancestor
  // that also belongs to the rule's set, the outer reflow already
  // includes us. Acting at every level would emit overlapping edits
  // that the applier rejects and would waste cascade passes.
  if hasReflowAncestor(node) {
    return
  }

  // Safety: abstain when the node carries comments outside its
  // children. The per-node printers join child docs with a fresh
  // `, ` separator and have no path for trivia between siblings, so
  // reflowing such a node would silently delete the comment.
  // Conservative — false positives mean a missed reflow opportunity,
  // not a regression. Coverage of inline comments inside lists is
  // the next slice of work.
  if hasNonChildComments(node, src, start, end) {
    return
  }

  printOpts.StartingColumn = leadingColumn(src, start, printOpts.TabWidth)
  printOpts.BaseIndent = lineLeadingIndent(src, start, printOpts.TabWidth)

  // Fast path: if the node's existing single-line bytes already fit
  // the printWidth budget, the reflowed output cannot differ from
  // the source (the printer would render the same flat shape). Skip
  // the Doc build + render entirely. This is the common case on
  // well-formatted code — every short call, every short literal —
  // and saves the allocations from PrintNode + Print.
  if !sliceContainsNewline(src, start, end) &&
    printOpts.StartingColumn+(end-start) <= printOpts.PrintWidth {
    return
  }

  printCtx := NewPrintContext(ctx.File, printOpts)
  doc, _ := PrintNode(printCtx, node)
  if doc.IsNil() {
    return
  }
  rendered := Print(doc, printOpts)
  original := src[start:end]
  if rendered == original {
    return
  }
  ctx.ReportRangeFix(
    start,
    end,
    "Reflow to fit printWidth.",
    TextEdit{Pos: start, End: end, Text: rendered},
  )
}

// leadingColumn returns the visual column the byte at `pos` occupies on
// its line. Tabs expand to `tabWidth` columns; other bytes count as 1.
// The rule uses this to seed the printer's StartingColumn so fit
// measurement charges the prefix against the column budget.
func leadingColumn(src string, pos int, tabWidth int) int {
  if pos <= 0 {
    return 0
  }
  if tabWidth <= 0 {
    tabWidth = 2
  }
  lineStart := lineStartOffset(src, pos)
  col := 0
  for i := lineStart; i < pos; i++ {
    if src[i] == '\t' {
      col += tabWidth - (col % tabWidth)
    } else {
      col++
    }
  }
  return col
}

// lineLeadingIndent returns the visual column of the first non-blank
// byte on the line containing `pos`. That is the indent the line's
// content starts at, regardless of where on the line the node itself
// sits.
//
// Continuation lines (Hardline / broken-mode Line) emitted by the
// reflow doc should align relative to this value, not relative to the
// node's leading column — see PrintOptions.BaseIndent for the contract.
//
// When the visited node lives on a *continuation line* (e.g. an RHS
// expression hanging below a binary operator on the previous line),
// the helper still returns the continuation line's own leading
// indent. This matches Prettier's convention: continuation indent
// anchors to the visual indent of the line carrying the node, not to
// the original statement's indent. Callers that need the latter
// would have to walk back through the AST themselves.
//
// `pos` must point at or after the first non-trivia byte on its line
// (callers in this file always pass `shimscanner.SkipTrivia` output,
// so the forward walk is bounded by that invariant in practice). The
// `i < pos` cap below makes the bound explicit, which keeps the
// helper safe against future callers that forget the precondition.
func lineLeadingIndent(src string, pos int, tabWidth int) int {
  if tabWidth <= 0 {
    tabWidth = 2
  }
  lineStart := lineStartOffset(src, pos)
  col := 0
  for i := lineStart; i < len(src) && i < pos; i++ {
    c := src[i]
    if c == ' ' {
      col++
      continue
    }
    if c == '\t' {
      col += tabWidth - (col % tabWidth)
      continue
    }
    break
  }
  return col
}

// sliceContainsNewline reports whether the byte range [start, end)
// contains a newline. Used by the fast path to certify that a node
// fits its source's single line so the rule can skip the Doc build.
func sliceContainsNewline(src string, start, end int) bool {
  if start < 0 {
    start = 0
  }
  if end > len(src) {
    end = len(src)
  }
  for i := start; i < end; i++ {
    if src[i] == '\n' {
      return true
    }
  }
  return false
}

// lineStartOffset returns the byte offset of the start of the line
// containing `pos`. Used by both column helpers above.
func lineStartOffset(src string, pos int) int {
  if pos <= 0 {
    return 0
  }
  for pos > 0 && src[pos-1] != '\n' {
    pos--
  }
  return pos
}

// hasReflowAncestor reports whether any ancestor of `node` would also
// match the format/print-width visitor. The rule uses this to suppress
// nested fires when an enclosing reflow target already covers the
// child.
func hasReflowAncestor(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  for parent := node.Parent; parent != nil; parent = parent.Parent {
    if isReflowKind(parent.Kind) {
      return true
    }
  }
  return false
}

func isReflowKind(k shimast.Kind) bool {
  switch k {
  case shimast.KindObjectLiteralExpression,
    shimast.KindArrayLiteralExpression,
    shimast.KindCallExpression,
    shimast.KindNewExpression,
    shimast.KindNamedImports,
    shimast.KindNamedExports,
    shimast.KindImportDeclaration:
    return true
  }
  return false
}

// hasNonChildComments scans the byte range [start, end) and returns true
// if any `//` or `/*` lives outside the union of `node`'s direct child
// byte ranges. The rule uses this to abstain from reflows that would
// drop inter-child comments — the v1 list printers join children with
// a fresh separator that has no slot for trivia between them.
//
// The scan is byte-level for simplicity: a TS scanner would also work
// but costs more. `inChild` masks comment-shaped bytes that live
// inside complete child token ranges (string and template literals
// are children, so `"//"` inside them never reaches the comment
// check). The residual conservative case is comment-shaped bytes
// inside an inter-child gap that the TS grammar would never tokenize
// as a comment — effectively nil for valid TypeScript source.
//
// `format/sort-imports` chose the opposite path on a similar shape:
// it actively preserves inter-specifier comments by walking the
// original byte ranges between elements. `format/print-width`
// abstains because the printer's separator (`,` + Line) is freshly
// minted and has no carrier slot for trivia. Extending preservation
// is a future slice; abstaining is byte-safe.
func hasNonChildComments(node *shimast.Node, src string, start, end int) bool {
  if node == nil {
    return false
  }
  type span struct{ pos, end int }
  var children []span
  node.ForEachChild(func(child *shimast.Node) bool {
    if child == nil {
      return false
    }
    // child.Pos() points at the start of leading trivia, which
    // can include comments belonging to the sibling boundary.
    // Trim past trivia so the inChild check only covers the
    // child's actual token bytes — comments between siblings
    // then surface to the scanner below.
    children = append(children, span{shimscanner.SkipTrivia(src, child.Pos()), child.End()})
    return false
  })
  inChild := func(i int) bool {
    for _, c := range children {
      if i >= c.pos && i < c.end {
        return true
      }
    }
    return false
  }
  for i := start; i < end-1 && i < len(src)-1; i++ {
    if inChild(i) {
      continue
    }
    if src[i] == '/' && (src[i+1] == '/' || src[i+1] == '*') {
      return true
    }
  }
  return false
}

func init() {
  Register(formatPrintWidth{})
}
