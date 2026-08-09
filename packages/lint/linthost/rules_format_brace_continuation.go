package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// formatBraceContinuation places a continuation keyword against the clause it
// continues, mirroring Prettier. The rule is one decision read in two
// directions, taken from the shape of the preceding clause:
//
//   - the clause is a block, so the keyword shares its closing brace's line:
//     `} else {`, `} catch (e) {`, `} finally {`, `} while (ready);`
//   - the clause is not a block, so the keyword starts its own line:
//     `if (a) x();` then `else y();`, and `do tick();` then `while (ready);`
//
// Both halves belong to one rule because they are the same decision. Splitting
// them across two owners lets a source satisfy neither, which is what the
// formatter did before: it never touched this boundary at all, so an
// Allman-braced file survived `ttsc format` unchanged and a one-line
// `if (a) x(); else y();` stayed on one line.
//
// The rule rewrites only the gap between the preceding clause's last byte and
// the continuation keyword's first byte. That gap is disjoint from every other
// format rule's surface: `format/clause-join` rewrites the gap AFTER a header
// token, `format/statement-split` splits statement-list members, and
// `format/indent` owns the leading whitespace of a line that already exists.
//
// A comment in the gap makes the rule abstain rather than relocate it, the same
// abstention `format/clause-join` and `format/statement-split` apply. Idempotent
// in both directions: once the keyword sits where it belongs the gap already
// holds the target text and the rule emits nothing.
type formatBraceContinuation struct{ optionsRule }

// formatBraceContinuationOptions carries the indentation and EOL settings the
// push-down direction needs to synthesize a line break. JSON tags match the
// `format` block keys the config layer mirrors in (see expandFormatBlock).
type formatBraceContinuationOptions struct {
  TabWidth  *int    `json:"tabWidth"`
  UseTabs   *bool   `json:"useTabs"`
  EndOfLine *string `json:"endOfLine"`
}

func (formatBraceContinuation) Name() string   { return "format/brace-continuation" }
func (formatBraceContinuation) IsFormat() bool { return true }

func (formatBraceContinuation) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindIfStatement,
    shimast.KindTryStatement,
    shimast.KindDoStatement,
  }
}

// braceContinuation is one keyword placement: the clause that precedes it and
// the keyword that continues it.
type braceContinuation struct {
  // previous is the clause the keyword continues. Its `End()` is the left edge
  // of the gap, and whether it is a block decides the direction.
  previous *shimast.Node
  // keyword is the exact lexeme expected at the right edge of the gap. The
  // following node cannot bound the scan: a catch clause and a finally block
  // both start at the preceding clause's end, so their Pos() is the gap's left
  // edge, not its right. Matching the lexeme instead is also what makes a
  // comment in the gap detectable, since the first non-whitespace byte is then
  // the comment rather than the keyword.
  keyword string
}

func (formatBraceContinuation) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || node == nil {
    return
  }
  var opts formatBraceContinuationOptions
  _ = ctx.DecodeOptions(&opts)
  eol := "\n"
  if opts.EndOfLine != nil && *opts.EndOfLine == "crlf" {
    eol = "\r\n"
  }
  src := ctx.File.Text()
  for _, continuation := range braceContinuations(node) {
    placeBraceContinuation(ctx, src, node, continuation, eol)
  }
}

// braceContinuations returns every continuation keyword `node` carries, paired
// with the clause it continues.
func braceContinuations(node *shimast.Node) []braceContinuation {
  switch node.Kind {
  case shimast.KindIfStatement:
    stmt := node.AsIfStatement()
    if stmt == nil || stmt.ElseStatement == nil || stmt.ThenStatement == nil {
      return nil
    }
    return []braceContinuation{{previous: stmt.ThenStatement, keyword: "else"}}
  case shimast.KindTryStatement:
    stmt := node.AsTryStatement()
    if stmt == nil || stmt.TryBlock == nil {
      return nil
    }
    out := make([]braceContinuation, 0, 2)
    previous := stmt.TryBlock.AsNode()
    if stmt.CatchClause != nil {
      out = append(out, braceContinuation{previous: previous, keyword: "catch"})
      previous = stmt.CatchClause
    }
    if stmt.FinallyBlock != nil {
      out = append(out, braceContinuation{previous: previous, keyword: "finally"})
    }
    return out
  case shimast.KindDoStatement:
    stmt := node.AsDoStatement()
    if stmt == nil || stmt.Statement == nil || stmt.Expression == nil {
      return nil
    }
    return []braceContinuation{{previous: stmt.Statement, keyword: "while"}}
  }
  return nil
}

func placeBraceContinuation(
  ctx *Context,
  src string,
  node *shimast.Node,
  continuation braceContinuation,
  eol string,
) {
  previous := continuation.previous
  if previous == nil {
    return
  }
  gapStart := previous.End()
  if gapStart < 0 || gapStart > len(src) {
    return
  }
  // The gap is the whitespace run after the preceding clause. The bytes that
  // follow it must be the continuation keyword itself: a comment there is
  // content the rewrite would delete, and it shows up as a first non-whitespace
  // byte that is not the keyword.
  keywordStart := gapStart
  for keywordStart < len(src) && isBraceContinuationGapByte(src[keywordStart]) {
    keywordStart++
  }
  if !braceContinuationKeywordAt(src, keywordStart, continuation.keyword) {
    return
  }

  want := " "
  if !braceContinuationEndsInBlock(previous) {
    // A non-block clause pushes the keyword onto its own line, indented to the
    // statement that owns it.
    if strings.Contains(src[gapStart:keywordStart], "\n") {
      return
    }
    want = eol + braceContinuationIndent(src, node)
  }
  if src[gapStart:keywordStart] == want {
    return
  }
  ctx.ReportRangeFix(
    gapStart,
    keywordStart,
    "Continuation keyword should sit against the clause it continues.",
    TextEdit{Pos: gapStart, End: keywordStart, Text: want},
  )
}

// braceContinuationIndent returns the leading whitespace of the line the
// statement starts on, which is the column Prettier gives the pushed-down
// keyword. A statement that does not start its own line contributes no indent,
// and `format/indent` owns that line's shape.
func braceContinuationIndent(src string, node *shimast.Node) string {
  start := shimscanner.SkipTrivia(src, node.Pos())
  if start < 0 || start > len(src) {
    return ""
  }
  lineStart := lineStartOffset(src, start)
  for i := lineStart; i < start; i++ {
    if src[i] != ' ' && src[i] != '\t' {
      return ""
    }
  }
  return src[lineStart:start]
}

// braceContinuationEndsInBlock reports whether the clause the keyword continues
// ends in a closing brace, which is what decides the direction. A catch clause
// is not itself a block and always ends in one by grammar, so asking for the
// node kind alone would send `finally` after a `catch` down the push-down path
// and leave it stranded on its own line.
func braceContinuationEndsInBlock(previous *shimast.Node) bool {
  return previous.Kind == shimast.KindBlock || previous.Kind == shimast.KindCatchClause
}

// braceContinuationKeywordAt reports whether `keyword` starts at `offset` as a
// whole token. The trailing boundary matters: `finally` must not match the
// `final` prefix of an identifier a comment left exposed.
func braceContinuationKeywordAt(src string, offset int, keyword string) bool {
  end := offset + len(keyword)
  if offset < 0 || end > len(src) || src[offset:end] != keyword {
    return false
  }
  return end == len(src) || !isBraceContinuationIdentifierByte(src[end])
}

// isBraceContinuationIdentifierByte reports whether `c` can appear inside an
// identifier, so a keyword is only accepted as a whole token.
func isBraceContinuationIdentifierByte(c byte) bool {
  return c == 0x5f || c == 0x24 ||
    (c >= 0x61 && c <= 0x7a) || (c >= 0x41 && c <= 0x5a) || (c >= 0x30 && c <= 0x39)
}

// isBraceContinuationGapByte reports whether `c` is whitespace that may appear
// between a clause and the keyword continuing it.
func isBraceContinuationGapByte(c byte) bool {
  return c == ' ' || c == '\t' || c == '\r' || c == '\n'
}

func init() {
  Register(formatBraceContinuation{})
}
