package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// formatClauseJoin joins a single non-block statement that sits on its
// own line back onto its control-flow header, mirroring Prettier:
//
//  if (a)
//    b();
//
// becomes `if (a) b();` when the joined line fits printWidth. The covered set
// is Prettier's, not the set whose header happens to end in `)`: the `if`
// consequent and alternate, the `for`, `for-in`, `for-of`, and `while` bodies,
// the `do` body, the `with` body, and a labeled statement's body. A braced
// body, a body that already shares the header line, a multi-line body, or a
// join that would overflow printWidth is left untouched.
//
// Two clauses join unconditionally because Prettier gives them no group of
// their own: an `else` whose alternate is another `if` (the `else if` chain),
// and a labeled statement, which prints `label: statement` on one line whatever
// the statement is, braces included. Those are the only clauses that can hoist a
// multi-line body, and their continuation lines move by the same column delta
// their first line travels, so the join does not settle on output Prettier would
// still reindent.
//
// A body containing a multi-line template literal abstains from the whole join.
// Its interior newlines carry string content, and shifting a line inside one
// would change the program's output rather than its layout. Prettier joins such
// a label; keeping the source is the deliberate trade.
//
// The rule only ever rewrites the whitespace gap between the clause's own
// header token and the controlled statement, so its edits never overlap
// `format/indent` (leading whitespace of a line) or `format/print-width`
// (interior reflow). Idempotent: once joined the gap holds no newline
// and the rule abstains.
type formatClauseJoin struct{ optionsRule }

// formatClauseJoinOptions mirrors the printWidth/indent keys the rule
// needs to decide whether the joined line fits. The config layer mirrors
// `format.printWidth`/`tabWidth`/`useTabs` into this rule's option blob
// (see expandFormatBlock).
type formatClauseJoinOptions struct {
  PrintWidth *int    `json:"printWidth"`
  TabWidth   *int    `json:"tabWidth"`
  UseTabs    *bool   `json:"useTabs"`
  EndOfLine  *string `json:"endOfLine"`
}

func (formatClauseJoin) Name() string   { return "format/clause-join" }
func (formatClauseJoin) IsFormat() bool { return true }

func (formatClauseJoin) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindIfStatement,
    shimast.KindWhileStatement,
    shimast.KindForStatement,
    shimast.KindForInStatement,
    shimast.KindForOfStatement,
    shimast.KindDoStatement,
    shimast.KindWithStatement,
    shimast.KindLabeledStatement,
  }
}

func (formatClauseJoin) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || node == nil {
    return
  }
  var opts formatClauseJoinOptions
  _ = ctx.DecodeOptions(&opts)
  printWidth := 80
  if opts.PrintWidth != nil && *opts.PrintWidth > 0 {
    printWidth = *opts.PrintWidth
  }
  tabWidth := 2
  if opts.TabWidth != nil && *opts.TabWidth > 0 {
    tabWidth = *opts.TabWidth
  }
  src := ctx.File.Text()
  for _, target := range clauseControlledBodies(node) {
    joinClauseBody(ctx, src, node, target, printWidth, tabWidth)
  }
}

// clauseJoinTarget is one joinable clause body plus the token that ends the
// clause header immediately before it. The anchor is what generalizes the rule
// past the `)`-headed statements: `else` and `do` end in a keyword, a labeled
// statement ends in `:`, and requiring the exact token still keeps a comment
// between header and body from being swallowed.
type clauseJoinTarget struct {
  body   *shimast.Node
  anchor string
  // alwaysJoin marks a clause Prettier keeps on the header line regardless of
  // the body's own line count or the joined width: an `else if` chain and a
  // labeled statement.
  alwaysJoin bool
}

// clauseControlledBodies returns every clause body of `node` that Prettier
// keeps on its header line, paired with the token that header ends in. The set
// is Prettier's, not the AST's: the `if` consequent and alternate, the loop
// bodies, the `do` body, the `with` body, and a labeled statement's body.
func clauseControlledBodies(node *shimast.Node) []clauseJoinTarget {
  switch node.Kind {
  case shimast.KindIfStatement:
    stmt := node.AsIfStatement()
    if stmt == nil {
      return nil
    }
    targets := []clauseJoinTarget{{body: stmt.ThenStatement, anchor: ")"}}
    if stmt.ElseStatement != nil {
      targets = append(targets, clauseJoinTarget{
        body:   stmt.ElseStatement,
        anchor: "else",
        // Prettier prints an `else if` chain flat, so the alternate being an
        // `if` joins even when that nested statement spans lines.
        alwaysJoin: stmt.ElseStatement.Kind == shimast.KindIfStatement,
      })
    }
    return targets
  case shimast.KindWhileStatement:
    return []clauseJoinTarget{{body: node.AsWhileStatement().Statement, anchor: ")"}}
  case shimast.KindForStatement:
    return []clauseJoinTarget{{body: node.AsForStatement().Statement, anchor: ")"}}
  case shimast.KindForInStatement, shimast.KindForOfStatement:
    return []clauseJoinTarget{{body: node.AsForInOrOfStatement().Statement, anchor: ")"}}
  case shimast.KindDoStatement:
    return []clauseJoinTarget{{body: node.AsDoStatement().Statement, anchor: "do"}}
  case shimast.KindWithStatement:
    return []clauseJoinTarget{{body: node.AsWithStatement().Statement, anchor: ")"}}
  case shimast.KindLabeledStatement:
    // A label carries no group of its own in Prettier: `label: statement` is
    // one line whatever the statement is, so the body may be a block and may
    // span lines.
    return []clauseJoinTarget{{
      body:       node.AsLabeledStatement().Statement,
      anchor:     ":",
      alwaysJoin: true,
    }}
  }
  return nil
}

func joinClauseBody(
  ctx *Context,
  src string,
  node *shimast.Node,
  target clauseJoinTarget,
  printWidth int,
  tabWidth int,
) {
  body := target.body
  if body == nil {
    return
  }
  // A braced body already owns its own line layout, except behind a label,
  // where Prettier writes `label: {`.
  if body.Kind == shimast.KindBlock && !target.alwaysJoin {
    return
  }
  // An empty-statement body glues directly to the header with NO space:
  // Prettier's adjustClause special-cases EmptyStatement and returns the bare
  // `;` (`while (x);`, `else;`, `do;`, `label:;`), only prepending a space when
  // the empty statement carries a leading comment. This rule joins with a
  // single space and deliberately does not take on the spaceless variant, so it
  // abstains and leaves the source shape rather than emitting `while (x) ;`.
  if body.Kind == shimast.KindEmptyStatement {
    return
  }
  bodyStart := shimscanner.SkipTrivia(src, body.Pos())
  bodyEnd := body.End()
  if bodyStart < 0 || bodyEnd < bodyStart || bodyEnd > len(src) {
    return
  }
  // The gap is the whitespace run immediately before the body. Walk back
  // over horizontal whitespace and newlines; the bytes before it must be the
  // clause's own header token so a comment between header and body (which
  // SkipTrivia would have stepped over) can never be swallowed.
  gapStart := bodyStart
  for gapStart > 0 && isClauseGapByte(src[gapStart-1]) {
    gapStart--
  }
  anchorStart := gapStart - len(target.anchor)
  if anchorStart < 0 || src[anchorStart:gapStart] != target.anchor {
    return
  }
  gap := src[gapStart:bodyStart]
  if !strings.Contains(gap, "\n") {
    return // body already shares the header line
  }
  // The header line is measured from the token that opens the clause. For a
  // `)`-headed statement and a label that is the statement's own start; for
  // `else` and `do` it is the keyword, which is where Prettier starts the line
  // it would print.
  headerStart := shimscanner.SkipTrivia(src, node.Pos())
  if isClauseAnchorWord(target.anchor) {
    headerStart = anchorStart
  }
  if headerStart < 0 || headerStart > gapStart {
    return
  }
  headerLineStart := lineStartOffset(src, headerStart)
  if strings.ContainsRune(src[headerLineStart:gapStart], '\n') {
    return
  }
  if !target.alwaysJoin {
    // The body must be single-line; a multi-line body (e.g. a nested clause
    // not yet joined) waits for the cascade to settle its inner join first.
    if strings.ContainsRune(src[bodyStart:bodyEnd], '\n') {
      return
    }
    joined := visualWidth(src[headerLineStart:gapStart], tabWidth) + 1 +
      visualWidth(src[bodyStart:bodyEnd], tabWidth)
    if joined > printWidth {
      return
    }
  }
  edits := []TextEdit{{Pos: gapStart, End: bodyStart, Text: " "}}
  // Hoisting the body's first line moves its base column. Every continuation
  // line has to move with it, or the join settles on output Prettier would
  // still reindent (#1139). Only an alwaysJoin clause can reach a multi-line
  // body; the others already abstained above.
  if strings.ContainsRune(src[bodyStart:bodyEnd], '\n') {
    shifted, ok := reindentJoinedClauseBody(
      ctx, src, headerLineStart, headerStart, bodyStart, bodyEnd, tabWidth,
    )
    if !ok {
      return
    }
    edits = append(edits, shifted...)
  }
  ctx.ReportRangeFix(
    gapStart,
    bodyStart,
    "Single-statement clause body should join its header line.",
    edits...,
  )
}

// reindentJoinedClauseBody returns the edits that move a hoisted body's
// continuation lines by the same column delta its first line travels, and
// reports whether the shift is safe to apply at all.
//
// The delta is the header line's own indent minus the indent of the line the
// body currently starts on, because the body's first line lands on the header
// line and Prettier prints its continuations relative to that. A line inside a
// template literal carries string content, and a line whose leading whitespace
// is shorter than an outdent would need is a shape the shift cannot express, so
// either one abstains from the whole join rather than half-applying it.
func reindentJoinedClauseBody(
  ctx *Context,
  src string,
  headerLineStart int,
  headerStart int,
  bodyStart int,
  bodyEnd int,
  tabWidth int,
) ([]TextEdit, bool) {
  templates := collectTemplateRanges(ctx.File, src)
  bodyLineStart := lineStartOffset(src, bodyStart)
  delta := visualWidth(src[headerLineStart:headerStart], tabWidth) -
    visualWidth(src[bodyLineStart:bodyStart], tabWidth)
  if delta == 0 {
    return nil, true
  }
  var edits []TextEdit
  for offset := bodyStart; offset < bodyEnd; offset++ {
    if src[offset] != '\n' {
      continue
    }
    if inTemplate(templates, offset) {
      return nil, false
    }
    lineStart := offset + 1
    indentEnd := lineStart
    for indentEnd < bodyEnd && (src[indentEnd] == ' ' || src[indentEnd] == '\t') {
      indentEnd++
    }
    if indentEnd >= bodyEnd {
      continue // trailing blank line inside the body carries no column
    }
    width := visualWidth(src[lineStart:indentEnd], tabWidth) + delta
    if width < 0 {
      return nil, false
    }
    next := strings.Repeat(" ", width)
    if src[lineStart:indentEnd] == next {
      continue
    }
    edits = append(edits, TextEdit{Pos: lineStart, End: indentEnd, Text: next})
  }
  return edits, true
}

// isClauseGapByte reports whether `c` is whitespace that may appear in
// the gap between a clause header and its controlled statement.
func isClauseGapByte(c byte) bool {
  return c == ' ' || c == '\t' || c == '\r' || c == '\n'
}

// isClauseAnchorWord reports whether an anchor is a keyword rather than
// punctuation, which decides where the width budget starts measuring. The
// anchor needs no identifier-boundary check: it is read backward from the AST
// body's own position, so the token before the gap is the clause's real keyword
// and an identifier ending in `else` or `do` cannot reach it.
func isClauseAnchorWord(anchor string) bool {
  return anchor == "else" || anchor == "do"
}

// visualWidth returns the display-column width of `s`: a tab expands to a flat
// `tabWidth` columns and everything else is charged by displayWidth, which is
// Prettier's own measurement. The only approximation left is the flat tab
// expansion (no tab-stop rounding), which never changes a real clause-join
// decision.
//
// Split on tabs rather than walked per rune, because displayWidth is not a sum
// over runes: an emoji sequence is measured whole, and splitting it would
// charge its parts.
func visualWidth(s string, tabWidth int) int {
  width := 0
  for i, segment := range strings.Split(s, "\t") {
    if i > 0 {
      width += tabWidth
    }
    width += displayWidth(segment)
  }
  return width
}

func init() {
  Register(formatClauseJoin{})
}
