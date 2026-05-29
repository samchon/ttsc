package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// formatIndent normalizes the leading indentation of each statement's
// first line to `depth * tabWidth` columns (or `depth` tabs under
// useTabs), mirroring Prettier's block indentation.
//
// The rule shares `format/statement-split`'s file-level walk: it
// registers for KindSourceFile and visits every statement in every
// statement list (SourceFile body, Block, ModuleBlock, case/default
// clause) at its nesting depth.
//
// Per-statement decision:
//
//  1. Find the statement's first non-trivia byte and the start of its
//     physical line.
//  2. Abstain unless the statement is the first non-whitespace token on
//     that line. A statement sharing a line with a previous statement is
//     `format/statement-split`'s surface; keeping the two rules disjoint
//     means their edits never overlap on one cascade pass.
//  3. Compare the leading-whitespace run `[lineStart, firstNonWS)` to the
//     desired indent. When they differ, replace the run with the indent.
//
// The rule only ever touches a statement's own starting line. Interior
// and continuation lines belong to `format/print-width`, which owns
// reflow indentation; rewriting them here would fight that rule.
//
// Idempotent: a correctly-indented statement compares equal in step 3
// and emits nothing.
type formatIndent struct{}

func (formatIndent) Name() string   { return "format/indent" }
func (formatIndent) IsFormat() bool { return true }
func (formatIndent) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}

func (formatIndent) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil {
    return
  }
  layout := loadFormatLayout(ctx)
  src := ctx.File.Text()
  var edits []TextEdit
  forEachStatementInList(ctx.File, func(stmt *shimast.Node, depth int) {
    // A statement whose indentation is owned by format/print-width's
    // expression reflow (it sits inside a call/new/array/object that the
    // printer lays out) must not be re-indented here: the printer hangs a
    // callback body under its call-argument column, which is deeper than
    // this rule's block-nesting depth, and reindenting it would oscillate
    // against the printer pass forever (the cascade never converges).
    if indentCededToReflow(stmt) {
      return
    }
    start := shimscanner.SkipTrivia(src, stmt.Pos())
    if start < 0 || start > len(src) {
      return
    }
    lineStart := lineStartOffset(src, start)
    // Only the leading run may be whitespace for this to be the first
    // token on its line. A non-whitespace byte in `[lineStart, start)`
    // means a previous statement shares the line — defer to
    // `format/statement-split`.
    for i := lineStart; i < start; i++ {
      if src[i] != ' ' && src[i] != '\t' {
        return
      }
    }
    want := layout.indent(depth)
    if src[lineStart:start] == want {
      return
    }
    edits = append(edits, TextEdit{Pos: lineStart, End: start, Text: want})
  })
  if len(edits) == 0 {
    return
  }
  ctx.ReportRangeFix(
    edits[0].Pos,
    edits[0].End,
    "Statement indentation must match its nesting depth.",
    edits...,
  )
}

// indentCededToReflow reports whether `stmt` lives inside an expression
// whose layout column format/indent cannot compute from block-nesting
// depth alone — a call/new argument, an array/object element, a
// conditional branch, or a parenthesized expression. format/indent's
// depth counts only Block/clause/declaration nesting, so a statement
// hung under such an expression (a callback body, a `new (class {…})()`
// method, a `cond ? () => {…} : …` arm) sits at a deeper column than its
// block depth, and reindenting it to depth*tabWidth both corrupts
// correct source and ping-pongs against format/print-width every cascade
// pass (the cascade never converges).
//
// Walking outward from the statement, an enclosing expression of those
// kinds means the indentation is owned by the printer (when print-width
// is active) or by the already-correct source (when it is off), so
// format/indent cedes. Reaching the source file or a module block first
// means the statement is in ordinary block/declaration position —
// format/indent owns it and indents to its nesting depth.
func indentCededToReflow(stmt *shimast.Node) bool {
  for n := stmt.Parent; n != nil; n = n.Parent {
    switch n.Kind {
    case shimast.KindCallExpression,
      shimast.KindNewExpression,
      shimast.KindArrayLiteralExpression,
      shimast.KindObjectLiteralExpression,
      shimast.KindConditionalExpression,
      shimast.KindParenthesizedExpression:
      return true
    case shimast.KindSourceFile,
      shimast.KindModuleBlock:
      return false
    }
  }
  return false
}

func init() {
  Register(formatIndent{})
}
