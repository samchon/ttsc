package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// formatPrintWidth reflows expressions and declarations so they fit
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
//  3. Build the node's Doc via PrintNode, which also reports a
//     `covered` flag.
//  4. Abstain when `covered` is false: the subtree holds a multi-line
//     verbatim node whose frozen columns would not survive a reflow.
//  5. Render with the configured printWidth / tabWidth / useTabs /
//     endOfLine.
//  6. Slice the original source bytes for the node's range.
//  7. If the rendered output differs, emit one TextEdit replacing
//     [start, end) with the new bytes.
//
// The "no diff → no edit" invariant is what keeps `ttsc format`
// idempotent: a second pass renders identical bytes, the comparison
// short-circuits, and the cascade converges. The `covered` abstain in
// step 4 is the safety floor: `ttsc format` either reflows correctly or
// leaves the node byte-identical — it never emits a half-reflowed,
// inconsistently indented shape.
//
// The rule is a format-class rule (IsFormat == true) so `ttsc format`
// applies its edits while `ttsc check` only emits diagnostics for
// configured severities. Reuses the `error` severity caveat from
// other format rules: only set `error` once the full reflow coverage
// is mature.
type formatPrintWidth struct{}

// formatPrintWidthOptions mirrors `TtscLintRuleOptions.PrintWidth`.
//
// TrailingComma reaches this rule because the printer's reflow decides
// whether to emit a trailing comma on every multi-line list — and that
// decision must match the user's `format.trailingComma` setting or the
// reflow oscillates against `format/trailing-comma` on every cascade
// pass. The config layer mirrors `format.trailingComma` into both
// rules' option blobs (see `expandFormatBlock` in config_format.go).
type formatPrintWidthOptions struct {
  PrintWidth    *int    `json:"printWidth"`
  TabWidth      *int    `json:"tabWidth"`
  UseTabs       *bool   `json:"useTabs"`
  EndOfLine     *string `json:"endOfLine"`
  TrailingComma *string `json:"trailingComma"`
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

// Known residual divergence from Prettier 3 (investigated against the
// nestjs / typeorm / vscode benchmark fixtures, not closed in this
// pass):
//
//   - Multi-line `reduce(...)` (or other single-arg method) calls where
//     Prettier 3 keeps the inline form because it fits print-width
//     minus the trailing-suffix budget. The current shrunk-budget
//     re-render still over-breaks some of these; the next slice should
//     measure fitsFirstLine against `pw - col - trailingNonComment`
//     before committing to the broken layout.
//   - Single-line `export type { X } from "long-path"` reexports.
//     Prettier 3 keeps them flat even when the whole declaration
//     overflows; ttsc-lint visits `KindNamedExports` in isolation and
//     breaks the brace clause. A real fix requires teaching the rule
//     about the surrounding ExportDeclaration so the brace clause is
//     measured against the full declaration line, or visiting
//     ExportDeclaration directly so the `from "..."` tail joins the
//     reflow surface.
//
// Both cases are tracked benchmark cases that forced
// `formatPrintWidth: 'off'` on the ttsc-lint branch. They are listed
// here so a future slice can pick them up without rediscovering the
// divergence.
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
  if opts.TrailingComma != nil {
    printOpts.TrailingComma = *opts.TrailingComma
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

  // Abstain on any node nested inside a template-literal substitution.
  // Prettier renders `${…}` expressions at printWidth:Infinity — it
  // never breaks an interpolation the source wrote on one line — so
  // reflowing a call or literal inside `${…}` would split the template
  // across lines and diverge from Prettier. See the printWidth:Infinity
  // branch in Prettier's printTemplateExpression.
  if hasTemplateSubstitutionAncestor(node) {
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
  // A node reflowed on a ternary-arm continuation line (`? expr` or
  // `: expr`) hangs its broken continuation under the arm's expression,
  // two columns past the `?`/`:` marker — not under the marker itself.
  printOpts.BaseIndent = lineLeadingIndent(src, start, printOpts.TabWidth) +
    ternaryArmIndentBonus(src, start)

  // trailingWidth is the column span of the tokens that stay on the
  // node's last line after `end` — a `;`, a `);`, a `) {`. The reflow
  // replaces only [start, end) and cannot move them, so both the fast
  // path and the layout budget must reserve those columns; otherwise
  // the rule emits a line that overflows by exactly the suffix.
  trailingWidth := trailingLineWidth(src, end, printOpts.TabWidth)

  // Fast path: if the node's existing single-line bytes already fit
  // the printWidth budget — prefix column, node width and trailing
  // suffix all charged — the reflowed output cannot differ from the
  // source (the printer would render the same flat shape). Skip the
  // Doc build + render entirely. This is the common case on
  // well-formatted code — every short call, every short literal —
  // and saves the allocations from PrintNode + Print.
  if !sliceContainsNewline(src, start, end) &&
    printOpts.StartingColumn+(end-start)+trailingWidth <= printOpts.PrintWidth {
    return
  }

  printCtx := NewPrintContext(ctx.File, printOpts)
  doc, covered := PrintNode(printCtx, node)
  if doc.IsNil() {
    return
  }
  // Safety abstain: the printed subtree contains a multi-line verbatim
  // node — one the dispatcher has no printer for. Such a node keeps the
  // source columns its lines were written at, while the reflow
  // re-indents everything around it. Emitting the edit would produce
  // inconsistently indented, corrupt output (a callback header at one
  // indent, its body frozen at another). Abstaining leaves the bytes
  // byte-identical, which is always safe. See the coverage-signal note
  // in print_dispatch.go.
  if !covered {
    return
  }
  // Render at the full printWidth budget. A reflow that breaks across
  // lines then makes every layout decision — which call argument hugs,
  // where a list explodes — against the true column budget. The
  // un-movable trailing suffix (`;`, `) {`, ` satisfies T`) lands on a
  // short last line; charging it against the whole budget would
  // wrongly penalize the interior lines and over-break the node.
  rendered := Print(doc, printOpts)
  // The one case the suffix genuinely shares the node's line is a
  // reflow that collapses to a single line. When the flat form plus
  // the suffix would overflow, re-render under a budget shrunk by the
  // suffix so the node breaks instead of spilling the suffix past
  // printWidth — the regression that keeps a call flat at exactly
  // printWidth while the trailing `;` runs over.
  if trailingWidth > 0 &&
    !strings.Contains(rendered, "\n") &&
    maxLineWidth(rendered, printOpts.StartingColumn, trailingWidth, printOpts.TabWidth) > printOpts.PrintWidth &&
    printOpts.PrintWidth-trailingWidth >= 1 {
    shrunk := printOpts
    shrunk.PrintWidth -= trailingWidth
    rendered = Print(doc, shrunk)
  }
  original := src[start:end]
  if rendered == original {
    return
  }
  // Safety floor: never emit an edit that makes the widest line wider
  // than it already was. The reflow may be unable to break an
  // un-breakable token run — a long string literal, a verbatim object
  // member — but it must never *worsen* the worst line. That is exactly
  // the regression this guards: `ttsc format` collapsing an
  // already-broken, fitting call into one over-wide line. A reflow that
  // only fixes indentation and leaves a pre-existing over-wide line
  // untouched is still emitted.
  renderedMax := maxLineWidth(rendered, printOpts.StartingColumn, trailingWidth, printOpts.TabWidth)
  originalMax := maxLineWidth(original, printOpts.StartingColumn, trailingWidth, printOpts.TabWidth)
  if renderedMax > printOpts.PrintWidth && renderedMax > originalMax {
    return
  }
  ctx.ReportRangeFix(
    start,
    end,
    "Reflow to fit printWidth.",
    TextEdit{Pos: start, End: end, Text: rendered},
  )
}

// trailingLineWidth returns the visual column width of src[end:] up to
// the next newline, with trailing whitespace trimmed. The formatPrintWidth
// reflow replaces only the node's own byte range, so whatever
// shares the node's last source line — a statement `;`, a `) {` header
// tail, a `, nextArg)` continuation — stays put. Charging that width
// against the budget keeps the rule from emitting a line that overflows
// by exactly the suffix it could never move.
//
// Trailing `//` line comments are excluded from the budget. A line
// comment runs to the end of the source line by definition, so breaking
// the reflowed node to make the comment fit cannot help — Prettier 3
// keeps the node inline and lets the comment trail (see typeorm's
// `comment.replaceAll(...) // Null bytes' shape that pushed
// `formatPrintWidth: 'off'` onto the ttsc-lint benchmark branch).
// Excluding the comment from `trailingLineWidth` matches that
// behavior: the fast path sees just the un-movable punctuation suffix,
// and the shrunk-budget re-render does not over-shrink and over-break.
func trailingLineWidth(src string, end int, tabWidth int) int {
  if end < 0 || end > len(src) {
    return 0
  }
  if tabWidth <= 0 {
    tabWidth = 2
  }
  lineEnd := trailingSuffixEnd(src, end)
  col := 0
  for i := end; i < lineEnd; i++ {
    if src[i] == '\t' {
      col += tabWidth - (col % tabWidth)
    } else {
      col++
    }
  }
  return col
}

// trailingSuffixEnd returns the byte offset where the node's un-movable
// trailing suffix ends on the line that begins at `end`. The walk stops
// at the first `//` line comment (Prettier-style "free" trailing
// attachment, see trailingLineWidth) or at the newline, then trims
// trailing whitespace so a `;<spaces><newline>` tail measures the
// `;` only. Trailing block comments inside the un-movable suffix span
// (`} /* note */`) keep their bytes counted; that path is rare and
// already exercised through the existing block-comment fixture.
func trailingSuffixEnd(src string, end int) int {
  lineEnd := end
  for lineEnd < len(src) && src[lineEnd] != '\n' {
    if src[lineEnd] == '/' && lineEnd+1 < len(src) {
      next := src[lineEnd+1]
      if next == '/' {
        // `//` line comment — Prettier treats the whole tail as a
        // trailing comment that runs to EOL. Drop it from the suffix
        // budget so the rule does not break the node to chase a
        // comment that cannot be moved or wrapped.
        break
      }
    }
    lineEnd++
  }
  for lineEnd > end {
    c := src[lineEnd-1]
    if c != ' ' && c != '\t' && c != '\r' {
      break
    }
    lineEnd--
  }
  return lineEnd
}

// maxLineWidth returns the widest effective column span among the lines
// of `text`. The first line is charged `startingColumn` — the prefix
// already on that source line that the reflow does not re-emit — and
// the last line is charged `trailingWidth` for the un-movable suffix
// that follows the node. Tabs count as `tabWidth` columns.
//
// The rule compares the rendered output's widest line against the
// source node's: a reflow that cannot fit an un-breakable token is
// still allowed through as long as it does not make the worst line any
// wider than it already was.
func maxLineWidth(text string, startingColumn, trailingWidth, tabWidth int) int {
  if tabWidth <= 0 {
    tabWidth = 2
  }
  lines := strings.Split(text, "\n")
  widest := 0
  for i, line := range lines {
    width := 0
    for _, r := range line {
      if r == '\t' {
        width += tabWidth - (width % tabWidth)
      } else if r != '\r' {
        width++
      }
    }
    if i == 0 {
      width += startingColumn
    }
    if i == len(lines)-1 {
      width += trailingWidth
    }
    if width > widest {
      widest = width
    }
  }
  return widest
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

// ternaryArmIndentBonus returns 2 when the line containing `pos` begins,
// after its leading whitespace, with a `? ` or `: ` ternary-arm marker,
// and 0 otherwise. formatPrintWidth adds it to BaseIndent so a node
// reflowed inside a ternary arm indents its broken continuation under
// the arm's expression rather than under the `?`/`:` token. In practice
// only a ternary arm opens a reflow target's line with `? ` / `: `; the
// two-byte prefix is a heuristic, and a rare false positive only shifts
// a broken continuation by two columns — it never corrupts bytes.
func ternaryArmIndentBonus(src string, pos int) int {
  i := lineStartOffset(src, pos)
  for i < len(src) && (src[i] == ' ' || src[i] == '\t') {
    i++
  }
  if i+1 < len(src) && (src[i] == '?' || src[i] == ':') && src[i+1] == ' ' {
    return 2
  }
  return 0
}

// hasReflowAncestor reports whether any ancestor of `node` would also
// match the formatPrintWidth visitor. The rule uses this to suppress
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

// hasTemplateSubstitutionAncestor reports whether `node` sits inside a
// template-literal substitution (`${…}`). formatPrintWidth abstains
// on such nodes: Prettier prints template interpolations at infinite
// printWidth and only keeps a break the source already had, so a reflow
// of a nested call or literal would split a one-line `${…}` and never
// match Prettier's output.
func hasTemplateSubstitutionAncestor(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  for parent := node.Parent; parent != nil; parent = parent.Parent {
    if parent.Kind == shimast.KindTemplateExpression {
      return true
    }
  }
  return false
}

// isReflowKind reports whether `k` is one of the node kinds the
// formatPrintWidth rule visits. Kept in sync with Visits() so
// hasReflowAncestor does not need to call Visits() at runtime.
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
