// unicorn/switch-case-break-position: a case body that consists of one
// non-empty block followed by a terminating statement leaves that terminator
// visually outside the block even though both statements belong to the same
// clause. The upstream rule reports the direct `break`, `continue`, `return`,
// or `throw` and moves only break/continue statements, whose binding semantics
// cannot change when they cross the block boundary.
//
// The fixer preserves the complete terminating statement (including labels),
// comments inside the block, the block body's indentation, and the source EOL.
// It declines edits when comments separate the block from the terminator, when
// a trailing comment belongs to the terminator, or when the block is single
// line. Return and throw remain diagnostic-only because moving them can change
// which block-scoped binding their expression resolves.
//
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/switch-case-break-position.md
package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type unicornSwitchCaseBreakPosition struct{}

func (unicornSwitchCaseBreakPosition) Name() string {
  return "unicorn/switch-case-break-position"
}

func (unicornSwitchCaseBreakPosition) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCaseClause, shimast.KindDefaultClause}
}

func (unicornSwitchCaseBreakPosition) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || node == nil {
    return
  }
  clause := node.AsCaseOrDefaultClause()
  if clause == nil || clause.Statements == nil {
    return
  }
  statements := clause.Statements.Nodes
  if len(statements) != 2 || statements[0] == nil || statements[1] == nil ||
    statements[0].Kind != shimast.KindBlock {
    return
  }
  blockNode, terminator := statements[0], statements[1]
  block := blockNode.AsBlock()
  if block == nil || block.Statements == nil || len(block.Statements.Nodes) == 0 {
    return
  }
  keyword, fixable := switchCaseBreakPositionTerminator(terminator)
  if keyword == "" {
    return
  }
  message := "Move `" + keyword + "` inside the block statement."
  if fixable {
    if edits, ok := switchCaseBreakPositionFix(ctx.File, blockNode, terminator); ok {
      ctx.ReportFix(terminator, message, edits...)
      return
    }
  }
  ctx.Report(terminator, message)
}

// switchCaseBreakPositionTerminator returns the statement keyword and whether
// upstream permits an automatic move. Return and throw expressions may resolve
// a different block-scoped binding after the move, so they are report-only.
func switchCaseBreakPositionTerminator(node *shimast.Node) (keyword string, fixable bool) {
  if node == nil {
    return "", false
  }
  switch node.Kind {
  case shimast.KindBreakStatement:
    return "break", true
  case shimast.KindContinueStatement:
    return "continue", true
  case shimast.KindReturnStatement:
    return "return", false
  case shimast.KindThrowStatement:
    return "throw", false
  default:
    return "", false
  }
}

func switchCaseBreakPositionFix(
  file *shimast.SourceFile,
  blockNode *shimast.Node,
  terminator *shimast.Node,
) ([]TextEdit, bool) {
  if file == nil || blockNode == nil || terminator == nil {
    return nil, false
  }
  block := blockNode.AsBlock()
  if block == nil || block.Statements == nil || len(block.Statements.Nodes) == 0 {
    return nil, false
  }
  source := file.Text()
  blockStart, blockEnd := tokenRange(file, blockNode)
  terminatorStart, terminatorEnd := tokenRange(file, terminator)
  if blockStart < 0 || blockEnd <= blockStart || blockEnd > len(source) ||
    terminatorStart < blockEnd || terminatorEnd < terminatorStart || terminatorEnd > len(source) ||
    source[blockEnd-1] != '}' {
    return nil, false
  }

  // Moving out of a one-line block would produce a malformed or misleading
  // layout. This is the same source-location gate used by upstream.
  blockSource := source[blockStart:blockEnd]
  if !strings.ContainsAny(blockSource, "\r\n") {
    return nil, false
  }

  gap := source[blockEnd:terminatorStart]
  if strings.TrimSpace(gap) != "" || hasCommentBetween(source, blockEnd, terminatorStart) {
    return nil, false
  }
  if switchCaseBreakPositionHasTrailingSameLineComment(source, terminatorEnd) {
    return nil, false
  }

  body := block.Statements.Nodes
  lastStatement := body[len(body)-1]
  lastStart, _ := tokenRange(file, lastStatement)
  if lastStatement == nil || lastStart < blockStart || lastStatement.End() > blockEnd-1 {
    return nil, false
  }
  insertPos := lastStatement.End()
  if _, commentEnd, ok := lastCommentInTrivia(source, insertPos, blockEnd-1); ok {
    insertPos = commentEnd
  }
  if insertPos < lastStatement.End() || insertPos > blockEnd-1 {
    return nil, false
  }

  indent := switchCaseBreakPositionIndent(source, lastStart)
  newline := switchCaseBreakPositionNewline(blockSource)
  statementText := source[terminatorStart:terminatorEnd]
  return []TextEdit{
    {Pos: insertPos, End: insertPos, Text: newline + indent + statementText},
    {Pos: blockEnd, End: terminatorEnd, Text: ""},
  }, true
}

// switchCaseBreakPositionIndent mirrors upstream getIndentString: use only the
// trailing horizontal whitespace before the last body statement, not arbitrary
// tokens that may precede it on the same physical line.
func switchCaseBreakPositionIndent(source string, pos int) string {
  if pos < 0 || pos > len(source) {
    return ""
  }
  lineStart := strings.LastIndex(source[:pos], "\n") + 1
  indentStart := pos
  for indentStart > lineStart &&
    (source[indentStart-1] == ' ' || source[indentStart-1] == '\t') {
    indentStart--
  }
  return source[indentStart:pos]
}

func switchCaseBreakPositionNewline(blockSource string) string {
  if index := strings.IndexByte(blockSource, '\n'); index >= 0 {
    if index > 0 && blockSource[index-1] == '\r' {
      return "\r\n"
    }
    return "\n"
  }
  if strings.ContainsRune(blockSource, '\r') {
    return "\r"
  }
  return "\n"
}

func switchCaseBreakPositionHasTrailingSameLineComment(source string, end int) bool {
  if end < 0 || end > len(source) {
    return true
  }
  lineEnd := len(source)
  if offset := strings.IndexAny(source[end:], "\r\n"); offset >= 0 {
    lineEnd = end + offset
  }
  return hasCommentBetween(source, end, lineEnd)
}

func init() {
  Register(unicornSwitchCaseBreakPosition{})
}
