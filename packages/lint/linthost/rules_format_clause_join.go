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
// becomes `if (a) b();` when the joined line fits printWidth. The same
// applies to `for`, `for-in`, `for-of`, and `while` headers. A braced
// body, a body that already shares the header line, a multi-line body,
// or a join that would overflow printWidth is left untouched.
//
// The rule only ever rewrites the whitespace gap between a header's
// closing `)` and the controlled statement, so its edits never overlap
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
  joinClauseBody(ctx, ctx.File.Text(), node, clauseControlledBody(node), printWidth, tabWidth)
}

// clauseControlledBody returns the single controlled statement of a
// control-flow header, the `then` branch for `if`, the loop body for
// the iteration statements. The `else` branch is intentionally excluded:
// its body is anchored after the `else` keyword rather than a `)`, so it
// does not share this rule's `)`-anchored join shape.
func clauseControlledBody(node *shimast.Node) *shimast.Node {
  switch node.Kind {
  case shimast.KindIfStatement:
    return node.AsIfStatement().ThenStatement
  case shimast.KindWhileStatement:
    return node.AsWhileStatement().Statement
  case shimast.KindForStatement:
    return node.AsForStatement().Statement
  case shimast.KindForInStatement, shimast.KindForOfStatement:
    return node.AsForInOrOfStatement().Statement
  }
  return nil
}

func joinClauseBody(
  ctx *Context,
  src string,
  node *shimast.Node,
  body *shimast.Node,
  printWidth int,
  tabWidth int,
) {
  if body == nil || body.Kind == shimast.KindBlock {
    return
  }
  // An empty-statement body (`while (x)\n;`) glues directly to the header with
  // NO space: Prettier's adjustClause special-cases EmptyStatement and returns
  // the bare `;` (`while (x);`), only prepending a space when the empty
  // statement carries a leading comment. This rule's gap->" " rewrite cannot
  // produce the spaceless `);` glue, so abstain and leave the source shape.
  if body.Kind == shimast.KindEmptyStatement {
    return
  }
  bodyStart := shimscanner.SkipTrivia(src, body.Pos())
  bodyEnd := body.End()
  if bodyStart < 0 || bodyEnd < bodyStart || bodyEnd > len(src) {
    return
  }
  // The gap is the whitespace run immediately before the body. Walk back
  // over horizontal whitespace and newlines; the byte before it must be
  // the header's closing `)` so a comment between header and body (which
  // SkipTrivia would have stepped over) can never be swallowed.
  gapStart := bodyStart
  for gapStart > 0 && isClauseGapByte(src[gapStart-1]) {
    gapStart--
  }
  if gapStart == 0 || src[gapStart-1] != ')' {
    return
  }
  gap := src[gapStart:bodyStart]
  if !strings.Contains(gap, "\n") {
    return // body already shares the header line
  }
  // The header and the body must each be single-line; a multi-line body
  // (e.g. a nested clause not yet joined) waits for the cascade to settle
  // its inner join first.
  headerStart := shimscanner.SkipTrivia(src, node.Pos())
  if headerStart < 0 || headerStart > gapStart {
    return
  }
  headerLineStart := lineStartOffset(src, headerStart)
  if strings.ContainsRune(src[headerLineStart:gapStart], '\n') {
    return
  }
  if strings.ContainsRune(src[bodyStart:bodyEnd], '\n') {
    return
  }
  joined := visualWidth(src[headerLineStart:gapStart], tabWidth) + 1 +
    visualWidth(src[bodyStart:bodyEnd], tabWidth)
  if joined > printWidth {
    return
  }
  ctx.ReportRangeFix(
    gapStart,
    bodyStart,
    "Single-statement clause body should join its header line.",
    TextEdit{Pos: gapStart, End: bodyStart, Text: " "},
  )
}

// isClauseGapByte reports whether `c` is whitespace that may appear in
// the gap between a clause header and its controlled statement.
func isClauseGapByte(c byte) bool {
  return c == ' ' || c == '\t' || c == '\r' || c == '\n'
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
