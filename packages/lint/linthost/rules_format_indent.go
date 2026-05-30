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
    // Cede when the enclosing block's opening line is itself indented as a
    // continuation, so format/indent's column-0 depth model does not apply.
    // A block whose `{` sits on a wrapped head line — a curried arrow
    // `): void => {`, a multi-line `if (\n …\n) {`, a multi-line heritage
    // `…\n{` — hangs its body under that head's indent, not under
    // depth*tabWidth from column 0. Reindenting to depth*tabWidth there
    // DE-INDENTS correct source. The body's correct indent is the opener
    // line's own indent plus one level; if that disagrees with `want`, the
    // depth model is wrong for this block and we leave the statement alone.
    if openerIndent, ok := enclosingBlockOpenerIndent(src, stmt); ok &&
      openerIndent+layout.indent(1) != want {
      return
    }
    edits = append(edits, TextEdit{Pos: lineStart, End: start, Text: want})
  })
  // Second pass: align each block's closing `}` line. A closing brace is
  // not a statement, so the walk above never touches it; without this a
  // mangled (flat) block body gets its statements re-indented while the
  // closing braces stay at their wrong column, and the cascade "converges"
  // on that malformed result (exit 0 on broken output). The brace aligns
  // to the block OWNER's depth — one level shallower than the block's own
  // statements — under the same cede / wrapped-head guards as the opening
  // pass, so an expression-nested or wrapped-head block's `}` is left to
  // the printer / its head.
  forEachBlockClose(ctx.File, func(block *shimast.Node, ownerDepth int) {
    closeBrace := blockCloseBracePos(src, block)
    if closeBrace < 0 {
      return
    }
    lineStart := lineStartOffset(src, closeBrace)
    // The `}` must be the first non-whitespace byte on its line; a brace
    // sharing a line with content (`} else {`, `{ x }`) is not this rule's
    // to move.
    for i := lineStart; i < closeBrace; i++ {
      if src[i] != ' ' && src[i] != '\t' {
        return
      }
    }
    // indentCededToReflow walks block.Parent upward — the same ancestor
    // chain a body statement would — so a callback / expression-nested
    // block's `}` cedes in lockstep with its body (print-width owns it).
    if indentCededToReflow(block) {
      return
    }
    want := layout.indent(ownerDepth)
    // Wrapped-head guard: when the block's own opener line is a continuation
    // (curried arrow `): void => {`, multi-line `if (\n) {`), the `}` aligns
    // to that opener line's indent, not to ownerDepth from column 0. If they
    // disagree, cede — the head owns this block's framing.
    openerIndent := blockOpenerLineIndent(src, block)
    if openerIndent != want {
      return
    }
    if src[lineStart:closeBrace] == want {
      return
    }
    edits = append(edits, TextEdit{Pos: lineStart, End: closeBrace, Text: want})
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

// enclosingBlockOpenerIndent returns the leading-whitespace string of the
// physical line that holds the opening brace of `stmt`'s nearest enclosing
// Block (or ModuleBlock). ok is false when the statement is not inside a
// block (a top-level statement, whose depth model is column-0 correct).
//
// The opener line is found from the Block node's start: a Block's Pos
// (after trivia) is its `{`. The string — not a visual width — is returned
// so the caller can compare it against the indent unit byte-for-byte and
// stay correct under mixed tabs/spaces.
func enclosingBlockOpenerIndent(src string, stmt *shimast.Node) (string, bool) {
  var block *shimast.Node
  for n := stmt.Parent; n != nil; n = n.Parent {
    switch n.Kind {
    case shimast.KindBlock, shimast.KindModuleBlock:
      block = n
    case shimast.KindSourceFile:
      n = nil
    }
    if block != nil || n == nil {
      break
    }
  }
  if block == nil {
    return "", false
  }
  brace := shimscanner.SkipTrivia(src, block.Pos())
  if brace < 0 || brace > len(src) {
    return "", false
  }
  ls := lineStartOffset(src, brace)
  i := ls
  for i < brace && (src[i] == ' ' || src[i] == '\t') {
    i++
  }
  return src[ls:i], true
}

// forEachBlockClose invokes fn for every Block / ModuleBlock in the file
// with the depth its OWNER sits at — the depth its closing `}` should
// align to (one level shallower than the block's own statements). It
// mirrors walkStatementLists's depth model so the two passes agree.
//
// A block that is the direct body of a case/default clause is skipped:
// its brace framing is special (the clause label already carries a level)
// and rare, so the rule cedes rather than risk a wrong column.
func forEachBlockClose(file *shimast.SourceFile, fn func(block *shimast.Node, ownerDepth int)) {
  if file == nil {
    return
  }
  walkBlockCloses(file.AsNode(), 0, fn)
}

func walkBlockCloses(node *shimast.Node, depth int, fn func(block *shimast.Node, ownerDepth int)) {
  if node == nil {
    return
  }
  node.ForEachChild(func(child *shimast.Node) bool {
    if child == nil {
      return false
    }
    childDepth := depth
    switch child.Kind {
    case shimast.KindBlock, shimast.KindModuleBlock:
      isCaseBody := child.Kind == shimast.KindBlock && child.Parent != nil &&
        (child.Parent.Kind == shimast.KindCaseClause ||
          child.Parent.Kind == shimast.KindDefaultClause)
      if isCaseBody {
        // Mirror walkStatementLists: a case-body block adds no level. Cede
        // its closing brace (no fn call).
        childDepth = depth
      } else {
        // The block's `}` aligns to the owner depth (this `depth`); its
        // statements nest one deeper.
        fn(child, depth)
        childDepth = depth + 1
      }
    case shimast.KindCaseClause, shimast.KindDefaultClause:
      childDepth = depth + 1
    case shimast.KindCaseBlock,
      shimast.KindClassDeclaration,
      shimast.KindClassExpression,
      shimast.KindInterfaceDeclaration,
      shimast.KindTypeLiteral,
      shimast.KindObjectLiteralExpression:
      childDepth = depth + 1
    }
    walkBlockCloses(child, childDepth, fn)
    return false
  })
}

// blockCloseBracePos returns the byte offset of a block's closing `}`.
// A block's End() points just past the `}`, so the brace is the last
// non-whitespace byte before End(); returns -1 if it is not a `}`.
func blockCloseBracePos(src string, block *shimast.Node) int {
  end := block.End()
  if end <= 0 || end > len(src) {
    return -1
  }
  for i := end - 1; i >= 0; i-- {
    c := src[i]
    if c == '}' {
      return i
    }
    if c != ' ' && c != '\t' && c != '\n' && c != '\r' {
      return -1
    }
  }
  return -1
}

// blockOpenerLineIndent returns the leading-whitespace string of the line
// holding `block`'s opening `{`. The closing-brace pass compares it to the
// owner indent so a wrapped-head block (curried arrow `): void => {`) whose
// `{` sits at a continuation indent cedes its `}` to that head.
func blockOpenerLineIndent(src string, block *shimast.Node) string {
  brace := shimscanner.SkipTrivia(src, block.Pos())
  if brace < 0 || brace > len(src) {
    return ""
  }
  ls := lineStartOffset(src, brace)
  i := ls
  for i < brace && (src[i] == ' ' || src[i] == '\t') {
    i++
  }
  return src[ls:i]
}

func init() {
  Register(formatIndent{})
}
