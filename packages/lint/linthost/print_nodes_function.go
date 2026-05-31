package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// Function-shaped and statement-body node printers: arrow functions,
// function expressions, parenthesized expressions, block statements,
// and the two leaf statements a callback body is almost always made of
// — expression statements and return statements.
//
// These printers exist for one job: make callback-bearing code
// (`new Singleton(() => { … })`, `foo(x, function () { … })`) reflow
// with *consistent* indentation. The headline bug they fix is the
// verbatim-column hazard — an un-handled multi-line node keeps the
// source columns its lines were written at, so when the enclosing call
// re-indents, the callback header and its body drift apart.
//
// Coverage discipline. The signature (parameters, `=>` / `function`
// keyword, return type) is emitted verbatim because it almost never
// contains a newline and is not a reflow target. The *body* is where
// the newlines live, so the body is dispatched through PrintNode and
// re-indented by the Doc engine. Each printer ANDs the body's `covered`
// flag into its own result: a body the dispatcher cannot fully control
// taints the whole subtree and the formatPrintWidth rule abstains.
//
// The expression- and return-statement printers carry the same
// discipline one level deeper: a callback body whose statements are
// themselves calls (`outer(() => { inner(() => { … }); })`) only
// reflows when those statements dispatch to a real printer. Without
// them every multi-line statement would be verbatim and a nested
// callback would always abstain.

// printArrowFunction renders an arrow function. The portion before the
// body — parameters, optional return type, `=>` token — is emitted
// verbatim; only the body participates in reflow.
//
//  verbatim prefix      reflowed body
//  ┌──────────────┐     ┌──────────┐
//  (a, b): number =>    { return a; }
//
// A concise (expression) body is dispatched directly. A block body
// flows through printBlock, which re-indents its statements relative
// to the printer's current indent.
//
// The second return value is the `covered` flag: see PrintNode. The
// verbatim prefix is single-line in every realistic arrow, but a
// pathological multi-line parameter list would still taint coverage.
func printArrowFunction(ctx *PrintContext, node *shimast.Node) (Doc, bool) {
  if node == nil {
    return Doc{}, true
  }
  arrow := node.AsArrowFunction()
  if arrow == nil || arrow.Body == nil {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  return printFunctionLike(ctx, node, arrow.Body)
}

// printFunctionExpression renders a `function` expression. Like the
// arrow printer, the signature is verbatim and only the body reflows.
// Function expressions always carry a block body, so the body always
// flows through printBlock.
//
// The second return value is the `covered` flag: see PrintNode.
func printFunctionExpression(ctx *PrintContext, node *shimast.Node) (Doc, bool) {
  if node == nil {
    return Doc{}, true
  }
  fn := node.AsFunctionExpression()
  if fn == nil || fn.Body == nil {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  return printFunctionLike(ctx, node, fn.Body)
}

// printFunctionLike is the shared body of the arrow / function-expression
// printers. It slices the verbatim signature from the node's first byte
// up to the body's first byte, dispatches the body, and concatenates
// the two.
//
// The signature slice intentionally includes the whitespace between the
// signature and the body (`=> ` keeps its trailing space, `) ` before a
// `function` body keeps its space) so the flat form reads naturally and
// the body's open brace lands where the user put it.
func printFunctionLike(ctx *PrintContext, node, body *shimast.Node) (Doc, bool) {
  nodeStart := shimscanner.SkipTrivia(ctx.Source, node.Pos())
  bodyStart := shimscanner.SkipTrivia(ctx.Source, body.Pos())
  if nodeStart < 0 || bodyStart < nodeStart || bodyStart > len(ctx.Source) {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  prefix := verbatimRange(ctx.Source, nodeStart, bodyStart)
  // A signature that itself spans multiple lines is a verbatim slice
  // with frozen interior columns — taint coverage so the rule abstains.
  prefixCovered := !strings.Contains(ctx.Source[nodeStart:bodyStart], "\n")
  bodyDoc, bodyCovered := PrintNode(ctx, body)
  return Concat(prefix, bodyDoc), prefixCovered && bodyCovered
}

// printParenthesizedExpression renders `( expr )`. The parentheses are
// fixed punctuation; the inner expression is dispatched so a call or
// object literal wrapped in parens still reflows.
//
// The second return value is the `covered` flag: see PrintNode.
func printParenthesizedExpression(ctx *PrintContext, node *shimast.Node) (Doc, bool) {
  if node == nil {
    return Doc{}, true
  }
  paren := node.AsParenthesizedExpression()
  if paren == nil || paren.Expression == nil {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  // A comment around the parens (`(/* c */ x)`, `(x /* c */)`) would be dropped
  // by the minted `(`/`)` — the parens are not AST children, so a nested
  // ParenthesizedExpression's gap comment slips past the top-level print-width
  // scan and is lost on reflow. Bail to verbatim (uncovered) like the
  // object/array/call printers.
  if listHasInterItemComments(ctx, node) {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  inner, covered := PrintNode(ctx, paren.Expression)
  return Concat(Text("("), inner, Text(")")), covered
}

// printBlock renders a `{ … }` block statement. A statement-free block
// collapses to `{}`. A non-empty block always renders multi-line —
// matching every JavaScript formatter — with each statement on its own
// line, indented one unit from the block's base indent and the closing
// brace back at the base indent.
//
//  {
//    stmt;
//    stmt;
//  }
//
// Each statement is dispatched through PrintNode, so a statement that
// is itself reflowable (a long call) gets reflowed and a plain
// statement falls back to verbatim. Because the engine re-applies the
// indent at every Hardline, even a verbatim statement lands at the
// correct column — the verbatim-column hazard only bites *multi-line*
// verbatim nodes, and those taint `covered` so the rule abstains.
//
// The second return value is the `covered` flag: see PrintNode. A block
// is uncovered when any statement is uncovered, or when the block
// carries a comment that lives outside every statement's byte range —
// the freshly minted Hardline separators have no carrier slot for such
// trivia, so reflowing would silently drop the comment. The
// comment check guards the statement-free path too: `{ /* note */ }`
// has no statements but is *not* an empty block — collapsing it to `{}`
// would delete the comment, so the printer emits it verbatim instead.
func printBlock(ctx *PrintContext, node *shimast.Node) (Doc, bool) {
  if node == nil {
    return Doc{}, true
  }
  block := node.AsBlock()
  if block == nil || block.Statements == nil {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  hasComment := blockHasNonStatementComment(ctx, node, block.Statements.Nodes)
  if len(block.Statements.Nodes) == 0 {
    if hasComment {
      // `{ /* … */ }` — not collapsible without dropping the comment.
      return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
    }
    return Text("{}"), true
  }
  stmts := block.Statements.Nodes
  items := make([]Doc, 0, len(stmts))
  covered := !hasComment
  for _, stmt := range stmts {
    if stmt == nil {
      return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
    }
    doc, childCovered := PrintNode(ctx, stmt)
    covered = covered && childCovered
    items = append(items, doc)
  }
  // Join statements with a Hardline, preserving a single user-authored
  // blank line between consecutive statements. The block printer mints
  // fresh separators, so a bare `Join(Hardline, …)` would silently
  // delete every blank line in the body on the first reflow. The blank
  // line is a Literalline — a bare newline with no indent — so the
  // empty line carries no trailing whitespace. Two or more blank lines
  // collapse to one, matching Prettier.
  bodyParts := make([]Doc, 0, len(items)*2)
  for i, item := range items {
    if i > 0 {
      // A lone leading-semicolon ASI guard stays glued to the statement
      // it protects (`;(expr)`): when the previous statement is an empty
      // `;` sitting directly against this one in the source, emit no line
      // break, so the reflow agrees with format/orphan-semi instead of
      // ping-ponging it back onto two lines every cascade pass.
      if stmts[i-1].Kind == shimast.KindEmptyStatement &&
        !rangeHasNewline(ctx.Source, stmts[i-1].End(), shimscanner.SkipTrivia(ctx.Source, stmts[i].Pos())) {
        bodyParts = append(bodyParts, item)
        continue
      }
      if blankLineBetweenStatements(ctx.Source, stmts[i-1].End(), stmts[i].Pos()) {
        bodyParts = append(bodyParts, Literalline())
      }
      bodyParts = append(bodyParts, Hardline())
    }
    bodyParts = append(bodyParts, item)
  }
  doc := Concat(
    Text("{"),
    Indent(ctx.indentUnit(), Hardline(), Concat(bodyParts...)),
    Hardline(),
    Text("}"),
  )
  return doc, covered
}

// rangeHasNewline reports whether src[start:end) contains a newline. Used
// to detect whether a leading-semicolon guard sits on the same line as
// the statement it protects.
func rangeHasNewline(src string, start, end int) bool {
  if start < 0 || end > len(src) || end <= start {
    return false
  }
  for i := start; i < end; i++ {
    if src[i] == '\n' {
      return true
    }
  }
  return false
}

// blankLineBetweenStatements reports whether the source gap between the
// end of one block statement and the start of the next contains a blank
// line — two or more newlines. printBlock uses it to keep a single
// user-authored blank line between statements. blockHasNonStatementComment
// has already guaranteed the gap holds no comment when the block is
// covered, so the gap is pure whitespace and counting newlines suffices.
func blankLineBetweenStatements(src string, prevEnd, nextPos int) bool {
  nextStart := shimscanner.SkipTrivia(src, nextPos)
  if prevEnd < 0 || nextStart > len(src) || nextStart <= prevEnd {
    return false
  }
  newlines := 0
  for i := prevEnd; i < nextStart; i++ {
    if src[i] == '\n' {
      newlines++
      if newlines >= 2 {
        return true
      }
    }
  }
  return false
}

// blockHasNonStatementComment reports whether the block's byte range
// holds a `//` or `/*` outside every statement's token range. The block
// printer joins statements with bare Hardlines that have no slot for
// inter-statement trivia, so a stray comment would be dropped by a
// reflow. Detecting it lets printBlock report the block uncovered and
// the formatPrintWidth rule abstain.
//
// The scan mirrors rules_format_print_width.go::hasNonChildComments:
// comment-shaped bytes inside a complete statement token range (string
// literals, nested comments) are masked, so only genuine
// inter-statement comments surface.
func blockHasNonStatementComment(ctx *PrintContext, node *shimast.Node, stmts []*shimast.Node) bool {
  start := shimscanner.SkipTrivia(ctx.Source, node.Pos())
  end := node.End()
  if start < 0 || end < start || end > len(ctx.Source) {
    return false
  }
  type span struct{ pos, end int }
  ranges := make([]span, 0, len(stmts))
  for _, stmt := range stmts {
    if stmt == nil {
      continue
    }
    ranges = append(ranges, span{shimscanner.SkipTrivia(ctx.Source, stmt.Pos()), stmt.End()})
  }
  inStatement := func(i int) bool {
    for _, r := range ranges {
      if i >= r.pos && i < r.end {
        return true
      }
    }
    return false
  }
  src := ctx.Source
  for i := start; i < end-1 && i < len(src)-1; i++ {
    if inStatement(i) {
      continue
    }
    if src[i] == '/' && (src[i+1] == '/' || src[i+1] == '*') {
      return true
    }
  }
  return false
}

// printExpressionStatement renders an `expr;` statement. The expression
// is dispatched so a callback-body statement that is itself a call or
// object literal reflows; the trailing `;` is preserved when the source
// carries one.
//
// The dispatcher reaches this printer through the block printer, so
// nested callbacks (`outer(() => { inner(() => { … }); })`) reflow at
// every depth instead of stalling on the verbatim fallback.
//
// The second return value is the `covered` flag: see PrintNode. The
// printer falls back to verbatim when the gap between the expression
// and the statement end holds anything other than the optional `;` and
// whitespace — a comment in that gap has no carrier slot and would be
// dropped.
func printExpressionStatement(ctx *PrintContext, node *shimast.Node) (Doc, bool) {
  if node == nil {
    return Doc{}, true
  }
  stmt := node.AsExpressionStatement()
  if stmt == nil || stmt.Expression == nil {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  if !tailIsCleanTerminator(ctx.Source, stmt.Expression.End(), node.End()) {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  exprDoc, covered := PrintNode(ctx, stmt.Expression)
  parts := []Doc{exprDoc}
  if sourceHasStatementTerminator(ctx.Source, node.End()) {
    parts = append(parts, Text(";"))
  }
  return Concat(parts...), covered
}

// printReturnStatement renders a `return expr;` statement. Like the
// expression-statement printer, the returned expression is dispatched
// so a returned callback or object literal reflows.
//
// A bare `return;` carries no expression and is emitted verbatim — it
// is a single token with nothing to reflow.
//
// The second return value is the `covered` flag: see PrintNode. The
// printer falls back to verbatim when the gap between the expression
// and the statement end holds anything but the optional `;` and
// whitespace.
func printReturnStatement(ctx *PrintContext, node *shimast.Node) (Doc, bool) {
  if node == nil {
    return Doc{}, true
  }
  stmt := node.AsReturnStatement()
  if stmt == nil || stmt.Expression == nil {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  if !tailIsCleanTerminator(ctx.Source, stmt.Expression.End(), node.End()) {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  exprDoc, covered := PrintNode(ctx, stmt.Expression)
  parts := []Doc{Text("return "), exprDoc}
  if sourceHasStatementTerminator(ctx.Source, node.End()) {
    parts = append(parts, Text(";"))
  }
  return Concat(parts...), covered
}

// tailIsCleanTerminator reports whether src[exprEnd:stmtEnd] holds only
// whitespace and at most one `;`. The expression- and return-statement
// printers consult it before re-minting the trailing `;`: a comment or
// any other token in that gap would be dropped by the reflow, so the
// printer must fall back to verbatim instead.
func tailIsCleanTerminator(src string, exprEnd, stmtEnd int) bool {
  if exprEnd < 0 || stmtEnd < exprEnd || stmtEnd > len(src) {
    return false
  }
  semis := 0
  for i := exprEnd; i < stmtEnd; i++ {
    switch src[i] {
    case ' ', '\t', '\r', '\n':
    case ';':
      semis++
      if semis > 1 {
        return false
      }
    default:
      return false
    }
  }
  return true
}
