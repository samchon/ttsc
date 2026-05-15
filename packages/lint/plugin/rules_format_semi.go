package main

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// format/semi enforces trailing semicolons on statements that participate
// in ASI. Mirrors prettier's `semi: true` default — *not* a tunable.
// Re-using the rule pulls projects that previously delegated to prettier
// onto a single source of truth without forcing them to keep prettier
// installed.
//
// The rule scans only statement kinds where TypeScript inserts an
// optional semicolon. Body-shaped declarations (functions, classes,
// namespaces, enums) and control-flow statements (if/for/while/try)
// are out of scope because they parse correctly without a terminator.
type formatSemi struct{}

func (formatSemi) Name() string     { return "format/semi" }
func (formatSemi) IsFormat() bool   { return true }

func (formatSemi) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindVariableStatement,
    shimast.KindExpressionStatement,
    shimast.KindReturnStatement,
    shimast.KindThrowStatement,
    shimast.KindBreakStatement,
    shimast.KindContinueStatement,
    shimast.KindDoStatement,
    shimast.KindDebuggerStatement,
    shimast.KindImportDeclaration,
    shimast.KindImportEqualsDeclaration,
    shimast.KindExportDeclaration,
    shimast.KindExportAssignment,
    shimast.KindPropertyDeclaration,
    shimast.KindTypeAliasDeclaration,
  }
}

func (formatSemi) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || node == nil {
    return
  }
  src := ctx.File.Text()
  end := node.End()
  if end <= 0 || end > len(src) {
    return
  }
  if src[end-1] == ';' {
    return
  }
  // Diagnostic anchors on the last character of the statement so the
  // banner underlines "the place a semicolon should follow". The fix
  // itself is a zero-width insertion at node.End() — keeping the edit
  // disjoint from any other rule's edits on the same statement.
  pos := end - 1
  if pos < 0 {
    pos = 0
  }
  ctx.ReportRangeFix(
    pos,
    end,
    "Missing semicolon.",
    TextEdit{Pos: end, End: end, Text: ";"},
  )
}

func init() {
  Register(formatSemi{})
}
