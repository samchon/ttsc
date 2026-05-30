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
    // means a previous statement shares the line, defer to
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
    // Cede everything inside a chained-arrow body (`a => b => { … }`).
    // Prettier indents such a body one extra level for the chain
    // continuation, so the body block AND every statement nested below it
    // sit one level deeper than the column-0 depth model computes;
    // reindenting any of them to depth*tabWidth de-indents correct source.
    // This is detected structurally (an ancestor block whose owning arrow is
    // itself another arrow's body), so a mangled input cannot fool it,
    // unlike a class method body, a switch case body, a single-head arrow,
    // or a multi-line-condition `if` body, all of which the depth model
    // places correctly.
    if cededByChainedArrowAncestor(stmt) {
      return
    }
    edits = append(edits, TextEdit{Pos: lineStart, End: start, Text: want})
  })
  // Second pass: align the block-closing `}` lines and the header lines
  // (class / interface / type-literal member declarations and
  // `case`/`default` labels) that are neither statements nor closing
  // braces. Both surfaces are visited by a single ForEachChild descent
  // (forEachIndentFrame) that tracks depth once and fires a brace callback
  // and a header callback at the right nodes/depths; the two callbacks
  // never target the same node, so this is exactly the two former
  // descents fused.
  //
  // Closing brace: a `}` is not a statement, so the statement walk never
  // touches it; without this a mangled (flat) block body gets its
  // statements re-indented while the closing braces stay at their wrong
  // column, and the cascade "converges" on that malformed result (exit 0
  // on broken output). The brace aligns to the block OWNER's depth, one
  // level shallower than the block's own statements, under the same cede /
  // wrapped-head guards as the opening pass, so an expression-nested or
  // wrapped-head block's `}` is left to the printer / its head.
  //
  // Header: the statement walk never visits a member declaration or a
  // clause label (neither is a statement), so without this a flattened
  // class body or switch leaves member headers and case labels at column 0
  // while their bodies are re-indented, a malformed result the cascade
  // reports as success.
  forEachIndentFrame(
    ctx.File,
    func(block *shimast.Node, ownerDepth int) {
      closeBrace := blockCloseBracePos(src, block)
      if closeBrace < 0 {
        return
      }
      lineStart := lineStartOffset(src, closeBrace)
      // The `}` must be the first non-whitespace byte on its line; a brace
      // sharing a line with content (`} else {`, `{ x }`) is not this
      // rule's to move.
      for i := lineStart; i < closeBrace; i++ {
        if src[i] != ' ' && src[i] != '\t' {
          return
        }
      }
      // indentCededToReflow walks block.Parent upward, the same ancestor
      // chain a body statement would, so a callback / expression-nested
      // block's `}` cedes in lockstep with its body (print-width owns it).
      if indentCededToReflow(block) {
        return
      }
      // Chained-arrow body: cede the `}` in lockstep with its body
      // statements. A chained-arrow body's own brace, and any brace nested
      // inside it, sit one extra level deep for the chain continuation, so
      // leave them be.
      if cededByChainedArrowAncestor(block) {
        return
      }
      want := layout.indent(ownerDepth)
      if src[lineStart:closeBrace] == want {
        return
      }
      edits = append(edits, TextEdit{Pos: lineStart, End: closeBrace, Text: want})
    },
    func(header *shimast.Node, depth int) {
      pos := shimscanner.SkipTrivia(src, header.Pos())
      if pos < 0 || pos > len(src) {
        return
      }
      lineStart := lineStartOffset(src, pos)
      for i := lineStart; i < pos; i++ {
        if src[i] != ' ' && src[i] != '\t' {
          return
        }
      }
      if indentCededToReflow(header) || cededByChainedArrowAncestor(header) {
        return
      }
      want := layout.indent(depth)
      if src[lineStart:pos] == want {
        return
      }
      edits = append(edits, TextEdit{Pos: lineStart, End: pos, Text: want})
    },
  )
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
// depth alone, a call/new argument, an array/object element, a
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
// means the statement is in ordinary block/declaration position,
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

// cededByChainedArrowAncestor reports whether `node` sits inside the body of
// a chained arrow (`a => b => { … }`). Prettier indents a chained arrow's
// body one extra level for the chain continuation, so the body block AND
// every statement / brace nested below it sit one level deeper than the
// column-0 depth model computes; format/indent must cede all of them or it
// de-indents correct source. Walking ancestor blocks (not just the nearest)
// catches a statement deep inside the body, e.g. an `if` body two levels
// down. Purely structural (AST kinds), so a mangled input cannot fool it,
// and it does NOT match a class method body, a switch case body, a
// single-head arrow body, or a multi-line-condition `if` body, those the
// depth model places correctly.
//
// `node` may be a statement (statement pass) or a Block (closing-brace
// pass). The walk starts at `node` itself so a Block argument's own
// chained-arrow-body-ness is tested (its `}` must cede too), then climbs
// ancestors for a statement nested deeper inside the body.
func cededByChainedArrowAncestor(node *shimast.Node) bool {
  for n := node; n != nil; n = n.Parent {
    if n.Kind == shimast.KindSourceFile {
      return false
    }
    if n.Kind == shimast.KindBlock {
      arrow := n.Parent
      if arrow != nil && arrow.Kind == shimast.KindArrowFunction &&
        arrow.Parent != nil && arrow.Parent.Kind == shimast.KindArrowFunction {
        return true
      }
    }
  }
  return false
}

// forEachIndentFrame walks the file's AST once and fires two callbacks at
// the nodes/depths the former forEachBlockClose and forEachIndentHeader
// descents fired, fused into a single ForEachChild descent that tracks
// depth once. The two former walks computed an identical childDepth for
// every child kind and only differed in which callback they fired on which
// node (the brace surface and the header surface never overlap on one
// node), so one descent firing both is exactly the two passes combined.
//
//   - brace(owner, ownerDepth): fired for every Block / ModuleBlock /
//     CaseBlock / class / interface / type-literal owner with the depth
//     its closing `}` aligns to (one level shallower than the owner's own
//     statements). A case-body Block fires at depth-1 so its `}` aligns
//     with the `case` label one level up. It mirrors walkStatementLists's
//     depth model so all indent passes agree.
//   - header(node, depth): fired for every class/interface/type-literal
//     member declaration and every case/default label with the depth its
//     header line should align to. A class/interface/type-literal body is
//     a +1 frame and its member headers sit at that body depth; a switch's
//     CaseBlock is a +1 frame and each case/default label sits at that
//     CaseBlock depth (its body statements nest one deeper, handled by the
//     statement pass).
func forEachIndentFrame(
  file *shimast.SourceFile,
  brace func(block *shimast.Node, ownerDepth int),
  header func(node *shimast.Node, depth int),
) {
  if file == nil {
    return
  }
  walkIndentFrames(file.AsNode(), 0, brace, header)
}

func walkIndentFrames(
  node *shimast.Node,
  depth int,
  brace func(block *shimast.Node, ownerDepth int),
  header func(node *shimast.Node, depth int),
) {
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
        // A case-body block (`case X: { … }`) adds no extra level for its
        // statements (they stay at the clause body depth, this `depth`), but
        // its own closing `}` aligns with the `case` label one level up.
        brace(child, depth-1)
        childDepth = depth
      } else {
        // The block's `}` aligns to the owner depth (this `depth`); its
        // statements nest one deeper.
        brace(child, depth)
        childDepth = depth + 1
      }
    case shimast.KindCaseClause, shimast.KindDefaultClause:
      // The label (`case X:` / `default:`) sits at the current (CaseBlock)
      // depth; its body statements nest one deeper.
      header(child, depth)
      childDepth = depth + 1
    case shimast.KindCaseBlock,
      shimast.KindClassDeclaration,
      shimast.KindClassExpression,
      shimast.KindInterfaceDeclaration,
      shimast.KindTypeLiteral:
      // These carry a real closing `}` that is not a Block node: a switch's
      // `}` (CaseBlock), a class/interface/type-literal body `}`. Align it to
      // the depth the owner sits at (this `depth`); the members/clauses nest
      // one deeper.
      brace(child, depth)
      childDepth = depth + 1
    case shimast.KindObjectLiteralExpression:
      // Object-literal braces live in expression position (assignments,
      // arguments); their layout is the printer's / source's, so leave the
      // `}` alone and only descend one level for any nested statement lists.
      childDepth = depth + 1
    case shimast.KindMethodDeclaration,
      shimast.KindPropertyDeclaration,
      shimast.KindGetAccessor,
      shimast.KindSetAccessor,
      shimast.KindConstructor,
      shimast.KindMethodSignature,
      shimast.KindPropertySignature,
      shimast.KindIndexSignature:
      // A class/interface/type-literal member: its header line sits at the
      // current body depth (the enclosing frame already bumped it).
      header(child, depth)
    }
    walkIndentFrames(child, childDepth, brace, header)
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

func init() {
  Register(formatIndent{})
}
